@echo off
title Actualizar Examen en GitHub
echo ========================================================
echo   Publicando cambios en GitHub Pages (Franklin1988)
echo ========================================================
echo.
git add index.html
git commit -m "update: reactivos oficiales del examen"
git push --force origin main
echo.
echo ========================================================
echo  Exito! Los cambios se estan actualizando en la web.
echo  Espera unos 30 segundos y refresca tu enlace.
echo ========================================================
pause
