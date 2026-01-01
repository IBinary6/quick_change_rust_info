export type Mirror = {
    id: string;
    name: string;
    registry: string;
    replaceWith: string; // usually 'mirror' or 'ustc' etc
};

export const MIRRORS: Mirror[] = [
    {
        id: "official",
        name: "Official (crates.io)",
        registry: "https://github.com/rust-lang/crates.io-index",
        replaceWith: "crates-io", // Effectively reset
    },
    {
        id: "ustc",
        name: "USTC (中科大)",
        registry: "sparse+https://mirrors.ustc.edu.cn/crates.io-index/",
        replaceWith: "ustc",
    },
    {
        id: "tuna",
        name: "TUNA (清华大学)",
        registry: "https://mirrors.tuna.tsinghua.edu.cn/git/crates.io-index.git",
        replaceWith: "tuna",
    },
    {
        id: "sjtu",
        name: "SJTU (上海交大)",
        registry: "https://mirrors.sjtug.sjtu.edu.cn/git/crates.io-index",
        replaceWith: "sjtu",
    },
    {
        id: "rsproxy",
        name: "Rsproxy (字节跳动)",
        registry: "sparse+https://rsproxy.cn/crates.io-index",
        replaceWith: "rsproxy",
    },
    {
        id: "aliyun",
        name: "Aliyun (阿里云)",
        registry: "https://code.aliyun.com/rustcc/crates.io-index.git",
        replaceWith: "aliyun",
    },
];
