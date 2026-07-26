namespace Erbu.Admin.Bff.Middleware;

public static class CorrelationIdMiddlewareExtensions
{
    private const string HeaderName = "X-Correlation-Id";

    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            if (!context.Request.Headers.ContainsKey(HeaderName))
            {
                context.Request.Headers[HeaderName] = Guid.NewGuid().ToString("N");
            }

            var correlationId = context.Request.Headers[HeaderName].ToString();
            context.Response.Headers[HeaderName] = correlationId;
            context.Items["CorrelationId"] = correlationId;

            await next();
        });
    }
}
