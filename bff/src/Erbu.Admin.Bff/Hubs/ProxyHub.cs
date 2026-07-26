using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections.Client;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace Erbu.Admin.Bff.Hubs;

public abstract class ProxyHub : Hub
{
    private static readonly ConcurrentDictionary<string, HubConnection> Downstreams = new();

    protected abstract string DownstreamConfigKey { get; }
    protected abstract string[] ForwardedMethods { get; }

    protected virtual void ConfigureAuth(HttpConnectionOptions options, HttpContext httpContext)
    {
        var token = httpContext.Request.Query["access_token"].ToString();
        if (!string.IsNullOrEmpty(token))
            options.AccessTokenProvider = () => Task.FromResult<string?>(token);
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext()!;
        var config = httpContext.RequestServices.GetRequiredService<IConfiguration>();
        var url = config[DownstreamConfigKey]
                  ?? throw new InvalidOperationException($"Missing config: {DownstreamConfigKey}");

        var caller = Clients.Caller;

        var connection = new HubConnectionBuilder()
            .WithUrl(url, options => ConfigureAuth(options, httpContext))
            .WithAutomaticReconnect()
            .Build();

        foreach (var method in ForwardedMethods)
        {
            var m = method;
            connection.On<JsonElement>(m, data => caller.SendAsync(m, data));
        }

        try
        {
            await connection.StartAsync();
            Downstreams[Context.ConnectionId] = connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Downstreams.TryRemove(Context.ConnectionId, out var conn))
            await conn.DisposeAsync();
        await base.OnDisconnectedAsync(exception);
    }

    protected async Task InvokeDownstream(string method, object? arg = null)
    {
        if (Downstreams.TryGetValue(Context.ConnectionId, out var conn))
            await conn.InvokeAsync(method, arg);
    }
}
