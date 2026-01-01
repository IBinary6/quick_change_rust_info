export interface SourceEntry {
    registry?: string;
    "replace-with"?: string;
}

export interface RegistryConfig {
    default?: string;
}

export interface NetConfig {
    offline?: boolean;
    "git-fetch-with-cli"?: boolean;
}

export interface HttpConfig {
    proxy?: string;
    "check-revoke"?: boolean;
    multiplexing?: boolean;
}

export interface HttpsConfig {
    proxy?: string;
}

export interface BuildConfig {
    jobs?: number;
    target?: string;
    "rustc-wrapper"?: string;
    rustflags?: string[];
    rustdocflags?: string[];
    [key: string]: any;
}

export interface TargetConfig {
    linker?: string;
    ar?: string;
    rustflags?: string[];
    runner?: string;
    [key: string]: any;
}

export interface ProfileConfig {
    "opt-level"?: string | number;
    lto?: string | boolean;
    "codegen-units"?: number;
    debug?: boolean | number;
    strip?: boolean | string;
    panic?: string;
    [key: string]: any;
}

export interface CargoConfig {
    source?: Record<string, SourceEntry>;
    registry?: RegistryConfig;
    net?: NetConfig;
    http?: HttpConfig;
    https?: HttpsConfig;
    build?: BuildConfig;
    target?: Record<string, TargetConfig>;
    env?: Record<string, any>;
    profile?: Record<string, ProfileConfig>;
    [key: string]: any;
}

// 常用目标平台
export const TARGET_PLATFORMS = [
    { value: "", label: "默认 (当前系统)" },
    { value: "x86_64-pc-windows-msvc", label: "Windows x64 (MSVC)" },
    { value: "x86_64-pc-windows-gnu", label: "Windows x64 (GNU/MinGW)" },
    { value: "i686-pc-windows-msvc", label: "Windows x86 (MSVC)" },
    { value: "x86_64-unknown-linux-gnu", label: "Linux x64 (GNU)" },
    { value: "x86_64-unknown-linux-musl", label: "Linux x64 (musl静态)" },
    { value: "aarch64-unknown-linux-gnu", label: "Linux ARM64" },
    { value: "x86_64-apple-darwin", label: "macOS x64" },
    { value: "aarch64-apple-darwin", label: "macOS ARM64 (M1/M2)" },
    { value: "wasm32-unknown-unknown", label: "WebAssembly" },
];

// 链接器选项
export const LINKER_OPTIONS = [
    { value: "", label: "默认链接器" },
    { value: "lld-link", label: "lld-link (LLVM, 推荐Windows)" },
    { value: "rust-lld", label: "rust-lld (Rust内置)" },
    { value: "mold", label: "mold (超快, Linux)" },
    { value: "gold", label: "gold (GNU Gold, Linux)" },
    { value: "link.exe", label: "link.exe (MSVC)" },
];

// 编译缓存选项
export const WRAPPER_OPTIONS = [
    { value: "", label: "无 (不使用缓存)" },
    { value: "sccache", label: "sccache (推荐)" },
    { value: "ccache", label: "ccache" },
];
