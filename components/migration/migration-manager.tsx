/**
 * Migration Management UI Component
 * 
 * Provides user interface for managing data migration process
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Database, 
  Upload, 
  RotateCcw,
  BarChart3,
  Settings,
  User,
  Calendar,
  Activity
} from 'lucide-react';

interface MigrationStatus {
  userId: string;
  eligible: boolean;
  migrated: boolean;
  queueStatus?: {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    priority: number;
    attempts: number;
    requestedAt: string;
  };
  history: MigrationHistory[];
  config: {
    rolloutEnabled: boolean;
    rolloutPercentage: number;
    maxConcurrentMigrations: number;
    migrationCooldownHours: number;
  };
}

interface MigrationHistory {
  id: string;
  status: 'completed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  entitiesMigrated?: number;
  sizeInBytes?: number;
  error?: string;
}

export function MigrationManager() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch migration status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/migration/status');
      if (!response.ok) {
        throw new Error('Failed to fetch migration status');
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  // Request migration
  const requestMigration = async () => {
    try {
      setRequesting(true);
      setError(null);
      
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 5 })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request migration');
      }
      
      await fetchStatus(); // Refresh status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request migration');
    } finally {
      setRequesting(false);
    }
  };

  // Auto-refresh status when processing
  useEffect(() => {
    fetchStatus();
    
    // Refresh every 5 seconds if processing
    let interval: NodeJS.Timeout;
    if (status?.queueStatus?.status === 'processing') {
      interval = setInterval(fetchStatus, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status?.queueStatus?.status]);

  // Get status badge color
  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'skipped': return 'outline';
      default: return 'secondary';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading migration status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchStatus} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Data Migration</CardTitle>
            </div>
            <Badge 
              variant={status.migrated ? "default" : "secondary"}
              className="capitalize"
            >
              {status.migrated ? "Migrated" : "Not Migrated"}
            </Badge>
          </div>
          <CardDescription>
            Migrate your local data to the cloud for better security and accessibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          {status.queueStatus && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Migration Status</span>
                </div>
                <Badge variant={getStatusBadgeVariant(status.queueStatus.status)}>
                  {status.queueStatus.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <span className="ml-2 font-medium">{status.queueStatus.priority}/10</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts:</span>
                  <span className="ml-2 font-medium">{status.queueStatus.attempts}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Requested:</span>
                  <span className="ml-2">
                    {new Date(status.queueStatus.requestedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {status.queueStatus.status === 'processing' && (
                <Progress value={33} className="mt-3" />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {!status.migrated && status.eligible && !status.queueStatus && (
              <Button 
                onClick={requestMigration}
                disabled={requesting}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>{requesting ? "Requesting..." : "Request Migration"}</span>
              </Button>
            )}

            {status.queueStatus?.status === 'failed' && (
              <Button 
                onClick={requestMigration}
                disabled={requesting}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Migration</span>
              </Button>
            )}

            <Button 
              onClick={fetchStatus}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Activity className="h-4 w-4" />
              <span>Refresh Status</span>
            </Button>

            <Button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>{showAdvanced ? "Hide" : "Show"} Advanced</span>
            </Button>
          </div>

          {/* Eligibility Warning */}
          {!status.eligible && !status.migrated && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're not currently eligible for migration. This may be due to:
                <ul className="list-disc ml-4 mt-1">
                  <li>Migration is being rolled out gradually</li>
                  <li>You recently attempted migration</li>
                  <li>Your account type doesn't qualify yet</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Advanced Information */}
      {showAdvanced && (
        <>
          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Migration Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rollout Enabled:</span>
                  <Badge variant={status.config.rolloutEnabled ? "default" : "secondary"}>
                    {status.config.rolloutEnabled ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rollout Percentage:</span>
                  <span>{status.config.rolloutPercentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max Concurrent:</span>
                  <span>{status.config.maxConcurrentMigrations}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cooldown Hours:</span>
                  <span>{status.config.migrationCooldownHours}h</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Card */}
          {status.history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Migration History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.history.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {item.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium capitalize">{item.status.replace('_', ' ')}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(item.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                        {item.duration && (
                          <div>
                            <span>Duration:</span>
                            <span className="ml-1">{formatDuration(item.duration)}</span>
                          </div>
                        )}
                        {item.entitiesMigrated && (
                          <div>
                            <span>Entities:</span>
                            <span className="ml-1">{item.entitiesMigrated}</span>
                          </div>
                        )}
                        {item.sizeInBytes && (
                          <div>
                            <span>Size:</span>
                            <span className="ml-1">{formatFileSize(item.sizeInBytes)}</span>
                          </div>
                        )}
                        {item.completedAt && (
                          <div>
                            <span>Completed:</span>
                            <span className="ml-1">
                              {new Date(item.completedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {item.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertDescription className="text-xs">{item.error}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}