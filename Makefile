NAME := RedBlock
VERSION := $(shell jq .version src/manifest.json)

.PHONY: default build clean zip srczip

default:
	@echo "$(NAME) $(VERSION)"
	@echo 'usage:'
	@echo '* make build: build extension'
	@echo '* make clean: clean extension dir'
	@echo '* make zip: compress extension into zip file'
	@echo '* make srczip: compress extension source into zip file (for upload to addons.mozilla.org)'
	@echo 'requirements: node, typescript'

build:
	tsc --version
	mkdir -p build/
	cp -r src/. build/
	tsc

clean:
	rm -rf build/ dist/

zip:
	mkdir -p dist/
	fd --type f \.ts build/ --exec rm
	fd --type f \.tsx build/ --exec rm
	cd build && zip -9 -X -r ../dist/$(NAME)-v$(VERSION).zip .

srczip:
	git archive -9 -v -o ./dist/$(NAME)-v$(VERSION).Source.zip HEAD

