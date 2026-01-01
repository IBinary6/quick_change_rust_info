import { CargoConfig, ProfileConfig } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Cpu, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface ProfileConfigProps {
    config: CargoConfig;
    onChange: (config: CargoConfig) => void;
}

export function ProfileConfigSection({ config, onChange }: ProfileConfigProps) {
    const [profileType, setProfileType] = useState<"release" | "dev">("release");

    const currentProfile = config.profile?.[profileType] || {};

    const updateProfile = (key: keyof ProfileConfig, value: any) => {
        const newProfile = { ...currentProfile, [key]: value };
        const newProfiles = { ...config.profile, [profileType]: newProfile };
        onChange({ ...config, profile: newProfiles });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Cpu className="h-6 w-6 text-orange-400 icon-glow" />
                    <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                        构建配置
                    </span>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    全局 Cargo 编译选项配置
                </CardDescription>
                <div className="flex gap-2 mt-3">
                    <Button 
                        variant={profileType === "release" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileType("release")}
                        className={profileType === "release" ? "" : "hover:border-orange-500/30"}
                    >
                        🚀 Release
                    </Button>
                    <Button 
                        variant={profileType === "dev" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileType("dev")}
                        className={profileType === "dev" ? "" : "hover:border-orange-500/30"}
                    >
                        🔧 Dev
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-5">
                     {/* Opt Level */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></span>
                            优化等级 (opt-level)
                        </label>
                        <Select 
                            value={String(currentProfile["opt-level"] ?? "")}
                            onChange={(e: any) => updateProfile("opt-level", e.target.value)}
                        >
                            <option value="">⚡ 默认</option>
                            <option value="0">0️⃣ 无优化</option>
                            <option value="1">1️⃣ 基础优化</option>
                            <option value="2">2️⃣ 常规优化</option>
                            <option value="3">3️⃣ 最大优化</option>
                            <option value="s">📦 优化体积 (s)</option>
                            <option value="z">🗜️ 最小体积 (z)</option>
                        </Select>
                    </div>

                    {/* LTO */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse"></span>
                            链接时优化 (LTO)
                        </label>
                         <Select 
                            value={String(currentProfile["lto"] ?? "")}
                            onChange={(e: any) => updateProfile("lto", e.target.value)}
                        >
                            <option value="">⚡ 默认</option>
                            <option value="false">❌ Off (关闭)</option>
                            <option value="true">✅ True (开启)</option>
                            <option value="thin">💨 Thin (轻量)</option>
                            <option value="fat">💪 Fat (完整)</option>
                        </Select>
                    </div>

                    {/* Strip */}
                    <div className="grid gap-2">
                         <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse"></span>
                            剥离符号 (Strip)
                        </label>
                         <Select 
                            value={String(currentProfile["strip"] ?? "")}
                            onChange={(e: any) => updateProfile("strip", e.target.value)}
                        >
                             <option value="">⚡ 默认</option>
                             <option value="true">✂️ True (剥离所有)</option>
                             <option value="false">📝 False (不剥离)</option>
                             <option value="debuginfo">🐛 Debuginfo</option>
                             <option value="symbols">🏷️ Symbols</option>
                        </Select>
                    </div>

                    {/* Codegen Units */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                            并发编译单元
                        </label>
                         <Input 
                            type="number" 
                            placeholder="⚡ 默认 (Default)"
                            value={currentProfile["codegen-units"] ?? ""}
                            onChange={(e: any) => updateProfile("codegen-units", e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                         <span className="text-xs text-muted-foreground">💡 设置为 1 可获得最大优化但编译最慢</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
