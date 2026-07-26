namespace Erbu.Admin.Bff.Hubs;

public sealed class AdminOrchestratorHub : ProxyHub
{
    protected override string DownstreamConfigKey => "DownstreamHubs:Orchestrator";

    protected override string[] ForwardedMethods =>
    [
        "JobUpdated",
        "ServiceUpdated",
        "DeploymentUpdated",
        "OrchestratorAlert",
    ];
}
