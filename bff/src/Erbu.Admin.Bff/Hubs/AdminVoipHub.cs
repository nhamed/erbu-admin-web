using System.Text.Json;

namespace Erbu.Admin.Bff.Hubs;

public sealed class AdminVoipHub : ProxyHub
{
    protected override string DownstreamConfigKey => "DownstreamHubs:Voip";

    protected override string[] ForwardedMethods =>
    [
        "ReceiveOffer",
        "ReceiveAnswer",
        "ReceiveIceCandidate",
        "CallStateChanged",
        "CallEnded",
    ];

    public Task SendOffer(JsonElement data) => InvokeDownstream("SendOffer", data);
    public Task SendAnswer(JsonElement data) => InvokeDownstream("SendAnswer", data);
    public Task SendIceCandidate(JsonElement data) => InvokeDownstream("SendIceCandidate", data);
    public Task StartCall(JsonElement data) => InvokeDownstream("StartCall", data);
    public Task EndCall(JsonElement data) => InvokeDownstream("EndCall", data);
}
