# Smoke: same Graph sendTemplate path CODTracked uses (live-messaging.ts).
# Usage (PowerShell):
#   .\scripts\smoke-whatsapp-template.ps1
# Or with args:
#   .\scripts\smoke-whatsapp-template.ps1 -AccessToken "EAAT..." -To "51916983980"

param(
  [string]$AccessToken = "",
  [string]$PhoneNumberId = "1238339816030934",
  [string]$To = "51916983980",
  [string]$TemplateName = "jaspers_market_order_confirmation_v1",
  [string]$LanguageCode = "en_US",
  [string]$ApiVersion = "v21.0",
  [string]$CustomerName = "sandro wong",
  [string]$OrderNumber = "1061",
  [string]$DateLabel = ""
)

if (-not $AccessToken) {
  # Plain Read-Host: SecureString often breaks long Meta tokens pasted with CR/LF.
  Write-Host "Pega el Access Token de WhatsApp (Meta) y pulsa Enter:"
  $AccessToken = Read-Host
}

# Strip whitespace / control chars from paste (CR, LF, zero-width, etc.)
$AccessToken = ($AccessToken -replace "[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]", "").Trim()
if (-not $AccessToken) {
  Write-Host "Token vacio." -ForegroundColor Red
  exit 1
}

if (-not $DateLabel) {
  $DateLabel = (Get-Date).ToString("MMM d, yyyy", [Globalization.CultureInfo]::GetCultureInfo("en-US"))
}

$toDigits = ($To -replace "\D", "")
$headers = @{
  Authorization  = "Bearer $AccessToken"
  "Content-Type" = "application/json"
}

Write-Host "`n=== 1) Health (como Probar conexion) ===" -ForegroundColor Cyan
$healthUri = "https://graph.facebook.com/$ApiVersion/$PhoneNumberId`?fields=display_phone_number,verified_name"
try {
  $health = Invoke-RestMethod -Method GET -Uri $healthUri -Headers @{ Authorization = "Bearer $AccessToken" }
  Write-Host ("OK phone={0} name={1}" -f $health.display_phone_number, $health.verified_name) -ForegroundColor Green
} catch {
  Write-Host "FAIL health:" -ForegroundColor Red
  Write-Host $_.ErrorDetails.Message
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host "`n=== 2) sendTemplate (mismo payload que CODTracked) ===" -ForegroundColor Cyan
$bodyObj = @{
  messaging_product = "whatsapp"
  to                = $toDigits
  type              = "template"
  template          = @{
    name     = $TemplateName
    language = @{ code = $LanguageCode }
    components = @(
      @{
        type = "body"
        parameters = @(
          @{ type = "text"; text = $CustomerName }
          @{ type = "text"; text = $OrderNumber }
          @{ type = "text"; text = $DateLabel }
        )
      }
    )
  }
}

$json = $bodyObj | ConvertTo-Json -Depth 8 -Compress
$sendUri = "https://graph.facebook.com/$ApiVersion/$PhoneNumberId/messages"
Write-Host "POST $sendUri"
Write-Host "to=$toDigits template=$TemplateName lang=$LanguageCode"

try {
  $res = Invoke-RestMethod -Method POST -Uri $sendUri -Headers $headers -Body $json
  $msgId = $res.messages[0].id
  Write-Host "OK smoke sendTemplate" -ForegroundColor Green
  Write-Host ("message_id={0}" -f $msgId)
  Write-Host "`nSi llego al celular, CODTracked puede enviar igual (token+plantilla+phone OK)."
  Write-Host "Siguiente: en el pedido -> Solicitar confirmacion WhatsApp."
} catch {
  Write-Host "FAIL sendTemplate" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  else { Write-Host $_.Exception.Message }
  Write-Host "`nRevisa: token, plantilla/idioma, numero en lista de prueba Meta."
  exit 1
}
