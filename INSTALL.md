# How to install

1. Run `go install -tags "fts5" github.com/lukasmwerner/mark@latest`
2. Create a local `lib` folder, e.g. `~/.lib` and download the appropriate [`cr-sqlite`](https://github.com/vlcn-io/cr-sqlite/releases) version for your OS/arch, for example:

```bash
wget https://github.com/vlcn-io/cr-sqlite/releases/download/v0.16.3/crsqlite-darwin-aarch64.zip -O ~/.lib/crsqlite.zip
```

3. Extract the library and add it to your dynamic library PATH:
```bash
cd ~/.lib/ && unzip crsqlite.zip
# MacOS spesific permissions fix
xattr -cr ~/.lib/crsqlite.dylib
echo 'export DYLD_LIBRARY_PATH=~/.lib' >> ~/.zshrc
```

4. Add `~/go/bin` to your PATH, or move `~/go/bin/mark` to a folder in your PATH.
