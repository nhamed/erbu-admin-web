using Erbu.Admin.Bff.Auth;
using Yarp.ReverseProxy.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

namespace Erbu.Admin.Bff.Transforms;

public sealed class AdminKeyTransformProvider : ITransformProvider
{
    private readonly AdminKeyProvider _keyProvider;

    public AdminKeyTransformProvider(AdminKeyProvider keyProvider)
    {
        _keyProvider = keyProvider;
    }

    public void ValidateRoute(TransformRouteValidationContext context) { }
    public void ValidateCluster(TransformClusterValidationContext context) { }

    public void Apply(TransformBuilderContext context)
    {
        if (context.Route.ClusterId != "geocoding-direct")
            return;

        context.AddRequestTransform(transformContext =>
        {
            transformContext.ProxyRequest.Headers.Remove("X-Admin-Key");
            transformContext.ProxyRequest.Headers.TryAddWithoutValidation(
                "X-Admin-Key", _keyProvider.GeoSearchAdminKey);
            return ValueTask.CompletedTask;
        });
    }
}
