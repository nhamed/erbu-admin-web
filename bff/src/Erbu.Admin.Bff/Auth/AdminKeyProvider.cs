namespace Erbu.Admin.Bff.Auth;

/// <summary>
/// Loads the geo-search X-Admin-Key from server-side secrets.
/// The key never reaches the browser — the BFF injects it into
/// downstream requests to GeocodingService hubs and REST endpoints.
/// </summary>
public sealed class AdminKeyProvider
{
    public string GeoSearchAdminKey { get; }

    public AdminKeyProvider(IConfiguration configuration)
    {
        GeoSearchAdminKey = configuration["Secrets:GeoSearchAdminKey"]
            ?? throw new InvalidOperationException("Secrets:GeoSearchAdminKey is required");
    }
}
