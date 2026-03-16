-include .deck

DECK_HOST     ?= deck@steamdeck.lan
STEAM_USER_ID ?=
STEAM_GAME_ID ?=

GRID_DIR = /home/deck/.local/share/Steam/userdata/$(STEAM_USER_ID)/config/grid

.PHONY: assets build bump deploy-art

assets:
	convert -size 3840x1240 xc:'#0d0d1a' \
	  -fill 'rgba(160,0,255,0.15)' -draw 'circle 2200,800 2900,800' \
	  -fill 'rgba(100,0,200,0.10)' -draw 'circle 900,400 1600,400' \
	  steam-assets/background.png
	convert -size 256x256 xc:none \
	  -fill '#cc0000' -draw 'roundrectangle 8,8 248,248 30,30' \
	  -fill white -draw 'polygon 80,60 80,196 196,128' \
	  steam-assets/icon.png
	convert -size 600x900 xc:'#0d0d1a' \
	  -fill 'rgba(160,0,255,0.15)' -draw 'circle 300,450 600,450' \
	  -fill 'rgba(100,0,200,0.10)' -draw 'circle 100,200 350,200' \
	  -fill '#cc0000' -draw 'roundrectangle 230,290 370,430 18,18' \
	  -fill white -draw 'polygon 272,320 272,400 340,360' \
	  -font DejaVu-Sans-Bold -pointsize 68 -fill white \
	  -gravity Center -annotate +0+60 'DECKTUBE' \
	  -font DejaVu-Sans-Bold -pointsize 22 -fill '#888888' \
	  -gravity Center -annotate +0+120 'YouTube for Steam Deck' \
	  steam-assets/cover.png
	convert -size 920x430 xc:'#0d0d1a' \
	  -fill 'rgba(160,0,255,0.15)' -draw 'circle 460,215 760,215' \
	  -fill 'rgba(100,0,200,0.10)' -draw 'circle 100,100 400,100' \
	  -fill '#cc0000' -draw 'roundrectangle 400,95 520,215 16,16' \
	  -fill white -draw 'polygon 436,121 436,189 494,155' \
	  -font DejaVu-Sans-Bold -pointsize 72 -fill white \
	  -gravity Center -annotate +0+72 'DECKTUBE' \
	  -font DejaVu-Sans-Bold -pointsize 22 -fill '#888888' \
	  -gravity Center -annotate +0+115 'YouTube for Steam Deck' \
	  steam-assets/wide_cover.png
	convert -size 1280x218 xc:none \
	  -fill '#cc0000' -draw 'roundrectangle 10,10 208,208 24,24' \
	  -fill white -draw 'polygon 58,44 58,174 174,109' \
	  -font DejaVu-Sans-Bold -pointsize 130 -fill white \
	  -annotate +230+168 'DECKTUBE' \
	  steam-assets/logo.png

build:
	npm run build:electron

bump:
	npm version patch

deploy-art:
	@test -n "$(STEAM_USER_ID)" || (echo "STEAM_USER_ID is required"; exit 1)
	@test -n "$(STEAM_GAME_ID)" || (echo "STEAM_GAME_ID is required"; exit 1)
	scp steam-assets/cover.png      $(DECK_HOST):$(GRID_DIR)/$(STEAM_GAME_ID)p.png
	scp steam-assets/wide_cover.png $(DECK_HOST):$(GRID_DIR)/$(STEAM_GAME_ID).png
	scp steam-assets/icon.png       $(DECK_HOST):$(GRID_DIR)/$(STEAM_GAME_ID)_icon.png
	scp steam-assets/logo.png       $(DECK_HOST):$(GRID_DIR)/$(STEAM_GAME_ID)_logo.png
	scp steam-assets/background.png $(DECK_HOST):$(GRID_DIR)/$(STEAM_GAME_ID)_hero.png
