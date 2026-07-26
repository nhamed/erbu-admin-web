namespace Erbu.Admin.Bff.Hubs;

public sealed class AdminTripPlannerHub : ProxyHub
{
    protected override string DownstreamConfigKey => "DownstreamHubs:TripPlanner";

    protected override string[] ForwardedMethods =>
    [
        "TripUpdated",
        "TripPlanned",
        "TwinSimulationCompleted",
    ];
}
