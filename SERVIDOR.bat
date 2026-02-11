@echo off
echo Iniciando servidor HTTP en el puerto 8000...
echo Abre tu navegador en: http://localhost:8000/base_idle.html
echo.
echo Presiona Ctrl+C para detener el servidor
echo.
python -m http.server 8000
pause
