import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { VoipCallState, VoipCallStatus } from '@erbu-admin-web/shared/models';
import { SignalRService } from './signalr.service';
import { Environment } from './environment';

export type CallType = 'audio' | 'video';

export interface CallSignal {
  callId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  payload: unknown;
}

@Injectable({ providedIn: 'root' })
export class VoipService implements OnDestroy {
  private readonly signalR = inject(SignalRService);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private readonly destroy$ = new Subject<void>();

  private readonly _callState = signal<VoipCallState | null>(null);
  private readonly _remoteStream = signal<MediaStream | null>(null);
  private readonly _localAudioEnabled = signal<boolean>(true);
  private readonly _localVideoEnabled = signal<boolean>(false);

  readonly callState = this._callState.asReadonly();
  readonly remoteStream = this._remoteStream.asReadonly();
  readonly localAudioEnabled = this._localAudioEnabled.asReadonly();
  readonly localVideoEnabled = this._localVideoEnabled.asReadonly();
  readonly isInCall = computed(
    () =>
      this._callState() !== null &&
      this._callState()!.status !== VoipCallStatus.Ended &&
      this._callState()!.status !== VoipCallStatus.Missed &&
      this._callState()!.status !== VoipCallStatus.Failed,
  );

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  async initialize(): Promise<void> {
    const hubPath = this.environment.signalrHubs.voip;
    await this.signalR.connectHub(hubPath);

    this.signalR.registerHandler(hubPath, 'ReceiveOffer');
    this.signalR.registerHandler(hubPath, 'ReceiveAnswer');
    this.signalR.registerHandler(hubPath, 'ReceiveIceCandidate');
    this.signalR.registerHandler(hubPath, 'CallStateChanged');
    this.signalR.registerHandler(hubPath, 'CallEnded');

    this.signalR.on<{ sdp: string; callId: string }>('ReceiveOffer').subscribe(async (data) => {
      await this.handleRemoteOffer(data.sdp, data.callId);
    });

    this.signalR.on<{ sdp: string }>('ReceiveAnswer').subscribe(async (data) => {
      await this.handleRemoteAnswer(data.sdp);
    });

    this.signalR
      .on<{ candidate: string; sdpMid: string; sdpMLineIndex: number }>('ReceiveIceCandidate')
      .subscribe(async (data) => {
        await this.handleRemoteIceCandidate(data);
      });

    this.signalR.on<VoipCallState>('CallStateChanged').subscribe((state) => {
      this._callState.set(state);
    });

    this.signalR.on<{ callId: string }>('CallEnded').subscribe(() => {
      this.cleanupCall();
    });
  }

  async initiateCall(targetId: string, type: CallType): Promise<void> {
    const isVideo = type === 'video';

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo,
    });

    this._localVideoEnabled.set(isVideo);
    this.createPeerConnection();

    for (const track of this.localStream.getTracks()) {
      this.peerConnection!.addTrack(track, this.localStream);
    }

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    await this.sendOffer(targetId, offer.sdp!, type);
  }

  async acceptCall(): Promise<void> {
    const state = this._callState();
    if (!state || state.status !== VoipCallStatus.Ringing) {
      return;
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    for (const track of this.localStream.getTracks()) {
      this.peerConnection!.addTrack(track, this.localStream);
    }

    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    await this.sendAnswer(state.callId, answer.sdp!);
  }

  async endCall(): Promise<void> {
    const state = this._callState();
    if (!state) return;

    const hubPath = this.environment.signalrHubs.voip;
    await this.signalR.invoke(hubPath, 'EndCall', state.callId);

    this.cleanupCall();
  }

  async sendOffer(targetId: string, sdp: string, type: CallType): Promise<void> {
    const hubPath = this.environment.signalrHubs.voip;
    await this.signalR.invoke(hubPath, 'SendOffer', { targetId, sdp, callType: type });
  }

  async sendAnswer(callId: string, sdp: string): Promise<void> {
    const hubPath = this.environment.signalrHubs.voip;
    await this.signalR.invoke(hubPath, 'SendAnswer', { callId, sdp });
  }

  async sendIceCandidate(
    callId: string,
    candidate: string,
    sdpMid: string,
    sdpMLineIndex: number,
  ): Promise<void> {
    const hubPath = this.environment.signalrHubs.voip;
    await this.signalR.invoke(hubPath, 'SendIceCandidate', {
      callId,
      candidate,
      sdpMid,
      sdpMLineIndex,
    });
  }

  toggleAudio(): void {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks();
    const enabled = !this._localAudioEnabled();
    audioTracks.forEach((track) => (track.enabled = enabled));
    this._localAudioEnabled.set(enabled);
  }

  toggleVideo(): void {
    if (!this.localStream) return;
    const videoTracks = this.localStream.getVideoTracks();
    const enabled = !this._localVideoEnabled();
    videoTracks.forEach((track) => (track.enabled = enabled));
    this._localVideoEnabled.set(enabled);
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const state = this._callState();
        if (state) {
          await this.sendIceCandidate(
            state.callId,
            event.candidate.candidate,
            event.candidate.sdpMid ?? '',
            event.candidate.sdpMLineIndex ?? 0,
          );
        }
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this._remoteStream.set(remoteStream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection?.connectionState === 'failed' ||
        this.peerConnection?.connectionState === 'closed'
      ) {
        this.cleanupCall();
      }
    };
  }

  private async handleRemoteOffer(sdp: string, callId: string): Promise<void> {
    this.createPeerConnection();
    const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp });
    await this.peerConnection!.setRemoteDescription(remoteDesc);
  }

  private async handleRemoteAnswer(sdp: string): Promise<void> {
    if (!this.peerConnection) return;
    const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp });
    await this.peerConnection.setRemoteDescription(remoteDesc);
  }

  private async handleRemoteIceCandidate(data: {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
  }): Promise<void> {
    if (!this.peerConnection) return;
    const candidate = new RTCIceCandidate({
      candidate: data.candidate,
      sdpMid: data.sdpMid,
      sdpMLineIndex: data.sdpMLineIndex,
    });
    await this.peerConnection.addIceCandidate(candidate);
  }

  private cleanupCall(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this._remoteStream.set(null);
    this._callState.set(null);
    this._localAudioEnabled.set(true);
    this._localVideoEnabled.set(false);
  }

  ngOnDestroy(): void {
    this.cleanupCall();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
