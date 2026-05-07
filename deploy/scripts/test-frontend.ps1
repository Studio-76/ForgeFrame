$ErrorActionPreference = "Stop"
python "$PSScriptRoot/test-frontend.py" @args
exit $LASTEXITCODE
