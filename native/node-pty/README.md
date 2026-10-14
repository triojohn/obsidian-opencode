# Vendored node-pty (Windows x64)

This directory is a trimmed copy of the npm package [`node-pty@1.1.0`](https://www.npmjs.com/package/node-pty)
(MIT License, see `LICENSE` in this folder). It is shipped inside the plugin so the
Windows PTY path can use node-pty's bundled ConPTY instead of the system `conhost`.

## Why

On Windows 10 build 19042 the system ConPTY strips mouse-related control sequences
(`?1000h`, `?1002h`, `?1003h`, `?1006h`, `?1049h`) from the terminal stream, so the
mouse does not work in the plugin terminal. node-pty can load a bundled
`conpty.dll` + `OpenConsole.exe` when spawned with `useConptyDll: true`; that build
passes the sequences through and restores mouse support.

The bundled binaries come from the NuGet package
`Microsoft.Windows.Console.ConPTY` (MIT License); node-pty vendors version
`1.23.251008001` under `third_party/conpty/win10-x64` and copies it into
`prebuilds/win32-x64/conpty/` at publish time. The copy in this folder is the
x64/win10 variant.

## Contents

Vendored from the package (nothing else is needed at runtime on Windows x64):

- `package.json`, `LICENSE`
- `lib/**` — all compiled CommonJS modules except `*.test.js` and `*.js.map`
- `prebuilds/win32-x64/pty.node` — winpty native module (loaded only when ConPTY is disabled)
- `prebuilds/win32-x64/conpty.node` — ConPTY native module
- `prebuilds/win32-x64/conpty_console_list.node` — helper used by `Conpty` teardown
- `prebuilds/win32-x64/conpty/conpty.dll`, `prebuilds/win32-x64/conpty/OpenConsole.exe` — bundled ConPTY

Intentionally omitted: `winpty.dll`, `winpty-agent.exe`, `*.pdb`, `darwin-*`,
`win32-arm64`, `linux-*`, `third_party/**`, `src/**`, `typings/**`, `scripts/**`,
`deps/**`, tests and examples.

`lib/utils.js` resolves native modules as
`<dir of lib>/../prebuilds/win32-x64/*.node`, and `conpty.node` looks for its DLL at
`<dir of conpty.node>/conpty/conpty.dll`, so the tree above must keep this layout.

Entry point used by the plugin: `native/node-pty/lib/index.js`.
