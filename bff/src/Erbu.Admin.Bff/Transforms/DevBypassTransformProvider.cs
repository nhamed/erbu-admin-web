using System.Security.Cryptography;
using System.Text;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace Erbu.Admin.Bff.Transforms;

public sealed class DevBypassTransformProvider : ITransformProvider
{
    private readonly string _secret;
    private readonly bool _enabled;

    public DevBypassTransformProvider(IConfiguration config, IWebHostEnvironment env)
    {
        _enabled = env.IsDevelopment();
        _secret = config["Auth:DevSecret"] ?? "dev-secret-erbu-docker-2024";
    }

    public void ValidateRoute(TransformRouteValidationContext context) { }
    public void ValidateCluster(TransformClusterValidationContext context) { }

    public void Apply(TransformBuilderContext context)
    {
        if (!_enabled) return;

        context.AddRequestTransform(ctx =>
        {
            var method = ctx.HttpContext.Request.Method.ToUpperInvariant();
            var path = ctx.ProxyRequest.RequestUri?.AbsolutePath
                       ?? ctx.HttpContext.Request.Path.Value ?? "/";
            var userId = "11111111-1111-1111-1111-111111111111";
            var roles = "admin";
            var scope = "sim-bypass,realtime.connect,admin:trips,admin:drivers,admin:riders,notifications";
            var exp = DateTimeOffset.UtcNow.AddSeconds(3600).ToUnixTimeSeconds().ToString();
            var nonce = Guid.NewGuid().ToString("N");

            var canonical = $"{method}\n{path}\n{userId}\n{roles}\n{scope}\n{exp}\n{nonce}";
            var keyBytes = Encoding.UTF8.GetBytes(_secret);
            var dataBytes = Encoding.UTF8.GetBytes(canonical);

            using var hmac = new HMACSHA256(keyBytes);
            var hash = hmac.ComputeHash(dataBytes);
            var sig = Convert.ToBase64String(hash).TrimEnd('=').Replace('+', '-').Replace('/', '_');

            var headers = ctx.ProxyRequest.Headers;
            headers.Remove("x-dev-user");
            headers.Remove("x-dev-roles");
            headers.Remove("x-dev-scope");
            headers.Remove("x-dev-exp");
            headers.Remove("x-dev-nonce");
            headers.Remove("x-dev-sig");

            headers.TryAddWithoutValidation("x-dev-user", userId);
            headers.TryAddWithoutValidation("x-dev-roles", roles);
            headers.TryAddWithoutValidation("x-dev-scope", scope);
            headers.TryAddWithoutValidation("x-dev-exp", exp);
            headers.TryAddWithoutValidation("x-dev-nonce", nonce);
            headers.TryAddWithoutValidation("x-dev-sig", sig);
            headers.TryAddWithoutValidation("X-Device-Id", "admin-web-bff");

            return ValueTask.CompletedTask;
        });
    }
}
