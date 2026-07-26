using Erbu.Admin.Bff.Auth;
using Erbu.Admin.Bff.Hubs;
using Erbu.Admin.Bff.Middleware;
using Erbu.Admin.Bff.Transforms;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Yarp.ReverseProxy.Transforms.Builder;

var builder = WebApplication.CreateBuilder(args);

// ---- Auth: OIDC JWT from EdgeGateway / AuthIdentityService ----
var authSection = builder.Configuration.GetSection("Auth");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = authSection["Authority"];
        o.Audience = authSection["Audience"] ?? "Erbu.Clients";
        o.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
        };

        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(o =>
{
    if (builder.Environment.IsDevelopment())
    {
        o.AddPolicy("RequireAdmin", p => p.RequireAssertion(_ => true));
        o.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAssertion(_ => true).Build();
    }
    else
    {
        o.AddPolicy("RequireAdmin", p => p.RequireClaim("role", "Admin", "Operator"));
    }
});

// ---- Admin key provider (server-side only, never exposed to browser) ----
builder.Services.AddSingleton<AdminKeyProvider>();

// ---- YARP reverse proxy transforms ----
builder.Services.AddSingleton<ITransformProvider, AdminKeyTransformProvider>();
builder.Services.AddSingleton<ITransformProvider, DevBypassTransformProvider>();
builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// ---- SignalR for hub proxying ----
builder.Services.AddSignalR();

// ---- CORS (dev only: Angular on :4200/:4201, BFF on :5200) ----
builder.Services.AddCors(o =>
{
    o.AddPolicy("DevCors", p => p
        .WithOrigins("http://localhost:4200", "http://localhost:4201")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

// ---- Middleware pipeline ----
app.UseCorrelationId();

if (app.Environment.IsDevelopment())
{
    app.UseCors("DevCors");
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// ---- SignalR proxy hubs ----
app.MapHub<AdminNotificationsHub>("/hubs/secure").RequireAuthorization();
app.MapHub<AdminVoipHub>("/hubs/voip").RequireAuthorization();
app.MapHub<AdminOrchestratorHub>("/hubs/orchestrator").RequireAuthorization();
app.MapHub<AdminTripPlannerHub>("/hubs/trip-planner").RequireAuthorization();
app.MapHub<AdminIngestionHub>("/hubs/ingestion").RequireAuthorization("RequireAdmin");
app.MapHub<AdminSearchOpsHub>("/hubs/search-ops").RequireAuthorization("RequireAdmin");

// ---- YARP proxy for REST APIs ----
app.MapReverseProxy();

// ---- SPA fallback: cockpit sub-app then main app ----
app.MapFallbackToFile("/cockpit/{**slug}", "cockpit/index.html");
app.MapFallbackToFile("index.html");

app.Run();
