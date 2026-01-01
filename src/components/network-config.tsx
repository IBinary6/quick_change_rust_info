import { CargoConfig, NetConfig, HttpConfig } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Wifi, Sparkles } from "lucide-react";

interface NetworkConfigProps {
    config: CargoConfig;
    onChange: (config: CargoConfig) => void;
}

export function NetworkConfigSection({ config, onChange }: NetworkConfigProps) {
    const net = config.net || {};
    const http = config.http || {};

    const updateNet = (key: keyof NetConfig, value: boolean) => {
        const newNet = { ...net, [key]: value };
        onChange({ ...config, net: newNet });
    };

    const updateHttp = (key: keyof HttpConfig, value: any) => {
        const newHttp = { ...http, [key]: value };
        onChange({ ...config, http: newHttp });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Wifi className="h-6 w-6 text-purple-400 icon-glow" />
                    <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                        网络配置
                    </span>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    设置 Cargo 离线模式及代理
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6">
                    {/* Offline */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                                离线模式
                            </label>
                            <p className="text-xs text-muted-foreground">断网时也能工作</p>
                        </div>
                        <Switch
                            checked={net.offline ?? false}
                            onChange={(e: any) => updateNet("offline", e.target.checked)}
                        />
                    </div>
                    
                    {/* CLI Fetch */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-pink-400"></span>
                                使用 CLI Fetch
                            </label>
                            <p className="text-xs text-muted-foreground">git-fetch-with-cli</p>
                        </div>
                        <Switch
                            checked={net["git-fetch-with-cli"] ?? false}
                            onChange={(e: any) => updateNet("git-fetch-with-cli", e.target.checked)}
                        />
                    </div>

                    {/* Proxy */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                            HTTP 代理
                        </label>
                        <Input 
                            placeholder="🌐 例: 127.0.0.1:7890"
                            value={http.proxy ?? ""}
                            onChange={(e: any) => updateHttp("proxy", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">💡 支持: http://127.0.0.1:7890</p>
                    </div>

                     {/* Multiplexing */}
                     <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                                HTTP 复用
                            </label>
                            <p className="text-xs text-muted-foreground">提升下载速度</p>
                        </div>
                        <Switch
                            checked={http.multiplexing ?? true} 
                            onChange={(e: any) => updateHttp("multiplexing", e.target.checked)}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
