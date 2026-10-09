PROJECT = VWTOBD.xcodeproj
SCHEME  = VWTOBD
BUILD   = .build
TEAM   ?= $(DEVELOPMENT_TEAM)

.PHONY: help sim device clean open

help:
	@echo ""
	@echo "  make sim      Build and run in iOS Simulator"
	@echo "  make device   Build and install on connected iPhone"
	@echo "  make open     Open project in Xcode"
	@echo "  make clean    Remove build artefacts"
	@echo ""
	@echo "  Pass your Team ID:  make device TEAM=XXXXXXXXXX"
	@echo "  Or export it once:  export DEVELOPMENT_TEAM=XXXXXXXXXX"
	@echo ""

sim:
	@./install.sh --simulator $(if $(TEAM),--team $(TEAM),)

device:
	@./install.sh $(if $(TEAM),--team $(TEAM),)

open:
	open $(PROJECT)

clean:
	rm -rf $(BUILD)
	@echo "Cleaned."
