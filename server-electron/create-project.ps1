param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    
    [Parameter(Mandatory=$false)]
    [string]$Description = "An Electron application with configuration management",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = ".."
)

# Fonction pour convertir en format kebab-case
function Convert-ToKebabCase {
    param([string]$str)
    $str = $str -replace "([a-z0-9])([A-Z])", '$1-$2'
    return $str.ToLower()
}

# Fonction pour convertir en PascalCase
function Convert-ToPascalCase {
    param([string]$str)
    $words = $str -split "-| "
    return ($words | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1).ToLower() }) -join ""
}

# Créer le nom du projet en différents formats
$kebabName = Convert-ToKebabCase $ProjectName
$pascalName = Convert-ToPascalCase $ProjectName
$fullPath = Join-Path $OutputPath $kebabName

Write-Host "Creating new project: $pascalName"
Write-Host "Location: $fullPath"

# Vérifier si le dossier existe déjà
if (Test-Path $fullPath) {
    Write-Error "Directory already exists: $fullPath"
    exit 1
}

# Créer le dossier du projet
New-Item -ItemType Directory -Path $fullPath | Out-Null

# Copier tous les fichiers du template
Copy-Item "index.js", "index.html", "renderer.js", "styles.css", "README.md", "package.json" -Destination $fullPath
Copy-Item "assets" -Destination $fullPath -Recurse

# Mettre à jour package.json
$packageJson = Get-Content (Join-Path $fullPath "package.json") | ConvertFrom-Json
$packageJson.name = $kebabName
$packageJson.productName = $pascalName
$packageJson.description = $Description
$packageJson | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $fullPath "package.json")

# Mettre à jour AppName dans index.js et renderer.js
$files = @("index.js", "renderer.js")
foreach ($file in $files) {
    $content = Get-Content (Join-Path $fullPath $file)
    $content = $content -replace "const AppName = '.*'", "const AppName = '$pascalName'"
    Set-Content (Join-Path $fullPath $file) $content
}

# Mettre à jour le titre dans index.html
$htmlFile = Join-Path $fullPath "index.html"
$html = Get-Content $htmlFile
$html = $html -replace "<title>.*</title>", "<title>$pascalName</title>"
Set-Content $htmlFile $html

# Mettre à jour README.md
$readmeFile = Join-Path $fullPath "README.md"
$readme = Get-Content $readmeFile
$readme = $readme -replace "# .*", "# $pascalName"
$readme = $readme -replace "Un template d'application.*", $Description
Set-Content $readmeFile $readme

Write-Host "`nProject created successfully!"
Write-Host "To get started:"
Write-Host "cd $kebabName"
Write-Host "npm install"
Write-Host "npm start"
