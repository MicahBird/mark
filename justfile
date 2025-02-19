default: setup install

# Variables
home_dir := env_var('HOME')
crsqlite_version := "v0.16.3"
os := `go env GOOS`
shell_rc := if path_exists(home_dir + "/.zshrc") == "true" { ".zshrc" } else { ".bashrc" }

_arch := `go env GOARCH`
cpu_arch := if _arch == "arm64" { "aarch64" } else { _arch }

# Show current configuration
vars:
    @echo "CRSQLite Version: {{crsqlite_version}}"
    @echo "OS: {{os}}"
    @echo "CPU Architecture: {{cpu_arch}}"
    @echo "Shell RC file: {{shell_rc}}"

# Setup CRSQLite
setup:
    #!/usr/bin/env bash
    mkdir -p deps
    mkdir -p {{home_dir}}/.lib
    curl -L -o deps/crsqlite.zip https://github.com/vlcn-io/cr-sqlite/releases/download/{{crsqlite_version}}/crsqlite-{{os}}-{{cpu_arch}}.zip
    unzip -o deps/crsqlite.zip -d deps
    cp deps/crsqlite.dylib {{home_dir}}/.lib/
    # Add DYLD_LIBRARY_PATH to RC file if not already present
    if ! grep -q "export DYLD_LIBRARY_PATH=" "{{home_dir}}/{{shell_rc}}"; then
        echo 'export DYLD_LIBRARY_PATH="$HOME/.lib:$DYLD_LIBRARY_PATH"' >> "{{home_dir}}/{{shell_rc}}"
        echo "Added DYLD_LIBRARY_PATH to {{shell_rc}}"
    fi

# Install the Go application
install: setup
    go install -tags "fts5" .

service-install: setup install
    mkdir -p "{{home_dir}}/Library/LaunchAgents"
    echo "Installing launch agent..."
    sed 's|$HOME|{{home_dir}}|g' template.plist > "{{home_dir}}/Library/LaunchAgents/com.lukaswerner.mark.server.plist"
    launchctl unload "{{home_dir}}/Library/LaunchAgents/com.lukaswerner.mark.server.plist" 2>/dev/null || true
    launchctl load "{{home_dir}}/Library/LaunchAgents/com.lukaswerner.mark.server.plist"
    echo "Launch agent installed and loaded"

# Uninstall the launch agent
service-uninstall:
    launchctl unload "{{home_dir}}/Library/LaunchAgents/com.lukaswerner.mark.server.plist" 2>/dev/null || true
    rm -f "{{home_dir}}/Library/LaunchAgents/com.lukaswerner.mark.server.plist"
    echo "Launch agent uninstalled"

# Check status of the service
status:
    launchctl list | grep "com.lukaswerner.mark.server" || echo "Service not running"

# View logs
logs:
    echo "=== STDOUT ==="
    cat /tmp/mark.server.stdout.log 2>/dev/null || echo "No stdout log found"
    echo -e "\n=== STDERR ==="
    cat /tmp/mark.server.stderr.log 2>/dev/null || echo "No stderr log found"

# Restart the service
restart: service-uninstall service-install

# Clean up everything
clean:
    rm -rf deps
    rm -f {{home_dir}}/.lib/crsqlite.dylib
