import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

export function UsageStats() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [data, setData] = useState<{ date: Date; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalProtected, setTotalProtected] = useState(0);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        if (!user) return;

        const fetchUsage = async () => {
            setLoading(true);
            try {
                const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
                const { data: deliveries, error } = await (supabase as any)
                    .from('watermark_deliveries')
                    .select('created_at')
                    .eq('user_id', user.id)
                    .gte('created_at', thirtyDaysAgo);

                if (!error && deliveries) {
                    // Process data for chart
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const date = startOfDay(subDays(new Date(), 6 - i));
                        const count = deliveries.filter((d: any) =>
                            isSameDay(new Date(d.created_at), date)
                        ).length;
                        return { date, count };
                    });

                    setData(last7Days);
                    setTotalProtected(deliveries.length);

                    // Calculate streak
                    let currentStreak = 0;
                    let checkDate = startOfDay(new Date());

                    // Check today
                    const hasToday = deliveries.some((d: any) => isSameDay(new Date(d.created_at), checkDate));
                    if (hasToday) {
                        currentStreak = 1;
                        while (true) {
                            checkDate = subDays(checkDate, 1);
                            const hasPrev = deliveries.some((d: any) => isSameDay(new Date(d.created_at), checkDate));
                            if (hasPrev) currentStreak++;
                            else break;
                        }
                    }
                    setStreak(currentStreak);
                }
            } catch (err) {
                console.error('Error fetching usage stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [user]);

    if (loading && data.length === 0) {
        return (
            <Card className="border-border/40 shadow-soft animate-pulse">
                <CardContent className="h-48" />
            </Card>
        );
    }

    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <Card className="border-border/40 shadow-soft bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        {t('dashboard.usageStats')}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            {streak} {t('dashboard.days')} streak
                        </div>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between h-24 gap-1 pt-2">
                    {data.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                            <div
                                className="w-full bg-primary/20 rounded-t-sm transition-all duration-500 group-hover:bg-primary/40 relative"
                                style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '2px' }}
                            >
                                {day.count > 0 && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {day.count}
                                    </div>
                                )}
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium uppercase">
                                {format(day.date, 'EEE')}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border/10">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            {t('dashboard.sheetsProtected')}
                        </p>
                        <p className="text-lg font-black text-foreground">{totalProtected}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            {t('dashboard.currentStreak')}
                        </p>
                        <p className="text-lg font-black text-primary">{streak} {t('dashboard.days')}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
