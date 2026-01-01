import { useEffect, useState } from "react";
import { MIRRORS } from "@/lib/mirrors";
import { CargoConfig } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
} from "@/components/ui/select";
import { Globe, Sparkles } from "lucide-react";

interface RegistryConfigProps {
    config: CargoConfig;
    onChange: (config: CargoConfig) => void;
}

export function RegistryConfigSection({ config, onChange }: RegistryConfigProps) {
    const [selectedMirror, setSelectedMirror] = useState<string>("official");

    useEffect(() => {
        if (config.source && config.source["crates-io"] && config.source["crates-io"]["replace-with"]) {
            const replaceWith = config.source["crates-io"]["replace-with"];
            const mirror = MIRRORS.find(m => m.replaceWith === replaceWith);
            if (mirror) {
                setSelectedMirror(mirror.id);
            } else {
                setSelectedMirror("custom");
            }
        } else {
            setSelectedMirror("official");
        }
    }, [config]);

    const handleMirrorChange = (mirrorId: string) => {
        setSelectedMirror(mirrorId);
        let newSource = { ...config.source };
        const mirror = MIRRORS.find(m => m.id === mirrorId);

        if (mirror && mirror.id !== "official") {
            newSource["crates-io"] = { "replace-with": mirror.replaceWith };
            newSource[mirror.replaceWith] = { registry: mirror.registry };
        } else if (mirrorId === "official") {
             if (newSource["crates-io"]) {
                 delete newSource["crates-io"];
             }
        }
        onChange({ ...config, source: newSource });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <Globe className="h-6 w-6 text-cyan-400 icon-glow" />
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        下载源配置
                    </span>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    选择 Cargo 包下载镜像源
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <div className="grid gap-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            镜像源
                        </label>
                        <Select 
                            value={selectedMirror}
                            onChange={(e: any) => handleMirrorChange(e.target.value)}
                        >
                            {MIRRORS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </Select>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground border-t border-white/5 pt-4">
                <span className="truncate">
                    📍 {MIRRORS.find(m => m.id === selectedMirror)?.registry || "Default"}
                </span>
            </CardFooter>
        </Card>
    );
}
