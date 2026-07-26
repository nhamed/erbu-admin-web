namespace Erbu.Admin.Bff.Hubs;

public sealed class AdminNotificationsHub : ProxyHub
{
    protected override string DownstreamConfigKey => "DownstreamHubs:Notifications";

    protected override string[] ForwardedMethods =>
    [
        "ReceivePositionUpdate",
        "ReceivePositionBatch",
        "ReceiveTripUpdate",
        "ReceiveFraudAlert",
        "ReceiveInfraAlert",
        "ReceiveSurgeUpdate",
        "ReceiveGeofenceUpdate",
    ];
}
