import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HistoryItem {
    id: string;
    original_file_name: string;
    new_file_name: string;
    created_at: string;
    watermark_id: string;
    status: 'protected' | 'failed';
}

export function RecentFiles() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [recentFiles, setRecentFiles] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from('watermark_deliveries')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!error && data) {
                    setRecentFiles(data.map((item: any) => ({
                        ...item,
                        status: 'protected'
                    })));
                }
            } catch (err) {
                console.error('Error fetching history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    if (loading && recentFiles.length === 0) {
        return (
            <Card className="border-border/40 shadow-soft">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        {t('dashboard.recentHistory')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 px-1">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (recentFiles.length === 0) return null;

    return (
        <Card className="border-border/40 shadow-soft overflow-hidden">
            <CardHeader className="pb-3 bg-muted/5 border-b border-border/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    {t('dashboard.recentHistory')}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/10">
                    {recentFiles.map((file) => (
                        <div key={file.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{file.original_file_name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {new Date(file.created_at).toLocaleDateString()} · {new Date(file.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={t('dashboard.downloadFile')}
                                    disabled
                                >
                                    <Download className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
