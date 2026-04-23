$ErrorActionPreference = "Stop"
python "$PSScriptRoot/test-backend.py" @args
exit $LASTEXITCODE
