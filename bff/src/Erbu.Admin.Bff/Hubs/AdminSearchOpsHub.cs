using Erbu.Admin.Bff.Auth;
using Microsoft.AspNetCore.Http.Connections.Client;

namespace Erbu.Admin.Bff.Hubs;

public sealed class AdminSearchOpsHub : ProxyHub
{
    protected override string DownstreamConfigKey => "DownstreamHubs:SearchOps";

    protected override string[] ForwardedMethods =>
    [
        "QueryMetricUpdate",
        "AlertTriggered",
    ];

    protected override void ConfigureAuth(HttpConnectionOptions options, HttpContext httpContext)
    {
        var keyProvider = httpContext.RequestServices.GetRequiredService<AdminKeyProvider>();
        options.Headers["X-Admin-Key"] = keyProvider.GeoSearchAdminKey;
    }
}
