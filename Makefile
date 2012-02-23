# TODO : Move all this make stuff into make.js

OVERRIDING=default

SRC_DIR = lib
TEST_DIR = test

PREFIX = .
DIST_DIR = ${PREFIX}/dist

COMPILER = ./node_modules/uglify-js/bin/uglifyjs -nc --unsafe

HEADER = ${SRC_DIR}/needs.header.js

FILES = ${HEADER}\
	${SRC_DIR}/needs.main.js\

VER = $(shell cat version.txt)

needs = ${DIST_DIR}/needs-${VER}.js
needs_MIN = ${DIST_DIR}/needs-${VER}.min.js
needs_LATEST = ${DIST_DIR}/needs-latest.js
needs_LATEST_MIN = ${DIST_DIR}/needs-latest.min.js


DATE=$(shell git log -1 --pretty=format:%ad)

BRANCH=$(git symbolic-ref -q HEAD)
BRANCH=${branch_name##refs/heads/}
BRANCH=${branch_name:-HEAD}

m=0
b=0

all: core node

core: min
	@@echo "needs build complete."

needs: 
	@@echo "Building" ${needs}
	@@echo "Version:" ${VER}

	@@mkdir -p ${DIST_DIR}

	@@cat ${FILES} | \
		sed 's/@DATE/'"${DATE}"'/' | \
		sed 's/@VERSION/'"${VER}"'/' > ${needs};

	@@cp ${needs} ${needs_LATEST}
	@@cp ${needs} ${PREFIX}/tests/amdjs-tests/impl/needs/needs.js

min: needs
	@@${COMPILER} ${needs} > ${needs_MIN}

	@@cat ${HEADER} ${needs_MIN} | \
		sed 's/@DATE/'"${DATE}"'/' | \
		sed 's/@VERSION/'"${VER}"'/' > tmp

	@@mv tmp ${needs_MIN}
	@@cp ${needs_MIN} ${needs_LATEST_MIN}

size: needs min
	@@gzip -c ${needs_MIN} > ${needs_MIN}.gz; \
	wc -c ${needs} ${needs_MIN} ${needs_MIN}.gz;
	@@rm ${needs_MIN}.gz; \

node:
	@@node make.js