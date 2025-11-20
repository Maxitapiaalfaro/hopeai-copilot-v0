/**
 * Migration Dashboard Component
 * 
 * Administrative dashboard for monitoring and managing migrations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Settings,
  BarChart3,
  Activity,
  Database,
  UserCheck,
  RotateCcw
} from 'lucide-react';

interface MigrationMetrics {
  totalUsers: number;
  eligibleUsers: number;
  migratedUsers: number;
  queueLength: number;
  processingRate: number;
  successRate: number;
  averageDuration: number;
  totalDataMigrated: number;
  recentActivity: {
    date: string;
    migrations: number;
    successes: number;
    failures: number;
  }[];
  userSegments: {
    segment: string;
    count: number;
    color: string;
  }[];
}

interface QueueItem {
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  priority: number;
  attempts: number;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export function MigrationDashboard() {
  const [metrics, setMetrics] = useState<MigrationMetrics | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/migration/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setMetrics(data.metrics);
      setQueue(data.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  // Execute migration for specific user
  const executeMigration = async (userId: string, dryRun = false) => {
    try {
      const response = await fetch('/api/migration/execute', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dryRun })
      });
      
      if (!response.ok) throw new Error('Failed to execute migration');
      
      await fetchMetrics(); // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute migration');
    }
  };

  // Rollback migration
  const rollbackMigration = async (userId: string) => {
    try {
      const response = await fetch('/api/migration/rollback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) throw new Error('Failed to rollback migration');
      
      await fetchMetrics(); // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback migration');
    }
  };

  // Auto-refresh
  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'Failed to load metrics'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Migration Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage data migration process</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'text-green-600' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.eligibleUsers} eligible for migration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Migration Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((metrics.migratedUsers / metrics.eligibleUsers) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.migratedUsers} of {metrics.eligibleUsers} users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.queueLength}</div>
            <p className="text-xs text-muted-foreground">
              {queue.filter(q => q.status === 'processing').length} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.successRate)}%</div>
            <p className="text-xs text-muted-foreground">
              Average duration: {Math.round(metrics.averageDuration / 1000)}s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Migration Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.recentActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="migrations" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="successes" stroke="#82ca9d" strokeWidth={2} />
                <Line type="monotone" dataKey="failures" stroke="#ff7c7c" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Segments */}
        <Card>
          <CardHeader>
            <CardTitle>User Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.userSegments}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {metrics.userSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Migration Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Queue</CardTitle>
          <CardDescription>
            Current migration requests and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items in queue
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <div key={item.userId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant={
                      item.status === 'completed' ? 'default' :
                      item.status === 'processing' ? 'default' :
                      item.status === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {item.status}
                    </Badge>
                    <div>
                      <div className="font-medium">{item.userId}</div>
                      <div className="text-sm text-muted-foreground">
                        Priority: {item.priority} • Attempts: {item.attempts}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.requestedAt).toLocaleTimeString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => executeMigration(item.userId, false)}
                      disabled={item.status === 'processing'}
                    >
                      Execute
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => executeMigration(item.userId, true)}
                    >
                      Dry Run
                    </Button>
                    {item.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rollbackMigration(item.userId)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Migration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Data Migration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <Database className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{metrics.totalDataMigrated}</div>
              <div className="text-sm text-muted-foreground">Total Records Migrated</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <UserCheck className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{metrics.migratedUsers}</div>
              <div className="text-sm text-muted-foreground">Users Migrated</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{Math.round(metrics.processingRate)}/day</div>
              <div className="text-sm text-muted-foreground">Processing Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}