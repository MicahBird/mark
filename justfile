default: setup install

crsqlite_version := "v0.16.3"
os := `go env GOOS`

_arch := `go env GOARCH`
cpu_arch := if _arch == "arm64" { "aarch64" } else { _arch } # convert from arm64 to aarch64

vars:
	@echo {{crsqlite_version}}
	@echo {{os}}
	@echo {{cpu_arch}}

setup:
	mkdir -p deps
	curl -L -o deps/crsqlite.zip https://github.com/vlcn-io/cr-sqlite/releases/download/{{crsqlite_version}}/crsqlite-{{os}}-{{cpu_arch}}.zip	
	unzip -o deps/crsqlite.zip -d deps



install: setup
    go install -tags "fts5" .
