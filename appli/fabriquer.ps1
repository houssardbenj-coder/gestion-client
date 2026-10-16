# Refabrique l'appli Pense intelligent apres une modification de ../pense-bete.html ou de src/.
# Resultat : ..\Pense-intelligent.apk (version officielle, signee avec la cle de
# C:\Users\houss\android-outils\cle-signature : NE PAS PERDRE ce dossier)
$ErrorActionPreference = "Continue"
$env:JAVA_HOME = "C:\Users\houss\android-outils\jdk"
Set-Location $PSScriptRoot
node build.js
if ($LASTEXITCODE -ne 0) { throw "Echec assemblage de la page" }
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Echec synchronisation Capacitor" }
Set-Location android
& .\gradlew.bat assembleRelease --no-daemon -q 2>&1 | Where-Object { "$_" -notmatch "SDK processing|^w: |^Note:" }
if ($LASTEXITCODE -ne 0) { throw "Echec fabrication Android (code $LASTEXITCODE)" }
Copy-Item app\build\outputs\apk\release\app-release.apk ..\..\Pense-intelligent.apk -Force
Copy-Item app\build\outputs\apk\release\app-release.apk "$env:USERPROFILE\Desktop\Pense-intelligent.apk" -Force
Copy-Item app\build\outputs\apk\release\app-release.apk ..\..\docs\Pense-intelligent.apk -Force
Write-Host "OK : Pense-intelligent.apk mis a jour (projet + Bureau + docs)."
