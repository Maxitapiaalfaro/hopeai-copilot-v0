# Análisis Longitudinal - Integration Guide
## Connecting Longitudinal Clinical Intelligence to Patient Library

**Target:** Phase 2 Implementation  
**Estimated Time:** 2 weeks  
**Complexity:** Medium

---

## Overview

This guide shows exactly how to integrate Longitudinal Analysis insights into the existing Patient Library interface, making them visible and accessible to psychologists.

**Goal:** Psychologists can:
1. See when new insights are available (badge notification)
2. View insights alongside Ficha Clínica
3. Request analysis manually
4. Engage with reflective questions

---

## Architecture Integration Points

```
Existing Flow:
Patient Library → Patient Detail → Ficha Clínica Panel

New Flow:
Patient Library → Patient Detail → [Ficha Clínica | Análisis Longitudinal] Tabs
                                  ↑
                              Badge when insights available
```

---

## Step-by-Step Integration

### 1. Add Pattern Mirror Tab to Ficha Clínica Panel

**File:** `components/patient-library/FichaClinicaPanel.tsx`

**Current Structure:**
```tsx
<SheetContent>
  <SheetHeader>
    <SheetTitle>Ficha Clínica - {patientName}</SheetTitle>
  </SheetHeader>
  
  {/* Ficha content */}
  <MarkdownRenderer content={latest.contenido} />
</SheetContent>
```

**New Structure with Tabs:**
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatternMirrorPanel } from '@/components/pattern-mirror-panel';
import { FileText, Sparkles } from 'lucide-react';

<SheetContent className="w-full sm:max-w-2xl">
  <SheetHeader>
    <SheetTitle>{patientName}</SheetTitle>
    <SheetDescription>
      Documentación clínica e insights de desarrollo
    </SheetDescription>
  </SheetHeader>
  
  <Tabs defaultValue="ficha" className="mt-6">
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="ficha" className="flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Ficha Clínica
      </TabsTrigger>
      <TabsTrigger value="insights" className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Pattern Insights
        {hasPendingInsights && (
          <Badge variant="destructive" className="ml-2">
            {pendingCount}
          </Badge>
        )}
      </TabsTrigger>
    </TabsList>
    
    <TabsContent value="ficha" className="mt-6">
      {/* Existing Ficha Clínica content */}
      {latest && latest.estado === 'completado' && (
        <MarkdownRenderer content={latest.contenido} />
      )}
    </TabsContent>
    
    <TabsContent value="insights" className="mt-6">
      <PatternMirrorPanel
        patientId={patientId}
        patientName={patientName}
      />
    </TabsContent>
  </Tabs>
</SheetContent>
```

**Props to Add:**
```tsx
interface FichaClinicaPanelProps {
  // ... existing props
  hasPendingInsights?: boolean;
  pendingInsightsCount?: number;
}
```

---

### 2. Add Insights Badge to Patient Library

**File:** `components/patient-library-section.tsx`

**Location:** Patient card in the list

**Current:**
```tsx
<Button
  variant="ghost"
  className="w-full justify-start"
  onClick={() => handlePatientClick(patient)}
>
  <div className="flex items-center gap-3">
    <Avatar>...</Avatar>
    <div className="flex-1 text-left">
      <p className="font-medium">{patient.displayName}</p>
      <p className="text-xs text-gray-500">
        {patient.sessions?.length || 0} sesiones
      </p>
    </div>
  </div>
</Button>
```

**New (with insights badge):**
```tsx
import { usePatternMirror } from '@/hooks/use-pattern-mirror';

// In component:
const { pendingCount } = usePatternMirror();

<Button
  variant="ghost"
  className="w-full justify-start relative"
  onClick={() => handlePatientClick(patient)}
>
  <div className="flex items-center gap-3 w-full">
    <Avatar>...</Avatar>
    <div className="flex-1 text-left">
      <p className="font-medium">{patient.displayName}</p>
      <p className="text-xs text-gray-500">
        {patient.sessions?.length || 0} sesiones
      </p>
    </div>
    
    {/* NEW: Insights badge */}
    {hasPatientInsights(patient.id) && (
      <Badge 
        variant="secondary" 
        className="bg-purple-100 text-purple-700 text-xs"
      >
        <Sparkles className="h-3 w-3 mr-1" />
        Nuevo insight
      </Badge>
    )}
  </div>
</Button>
```

**Helper Function:**
```tsx
const [patientInsights, setPatientInsights] = useState<Map<string, number>>(new Map());

const hasPatientInsights = (patientId: string): boolean => {
  return (patientInsights.get(patientId) || 0) > 0;
};

// Load insights on mount
useEffect(() => {
  const loadInsightCounts = async () => {
    const storage = getPatternAnalysisStorage();
    await storage.initialize();
    
    const pending = await storage.getPendingReviewAnalyses();
    const countMap = new Map<string, number>();
    
    pending.forEach(analysis => {
      const current = countMap.get(analysis.patientId) || 0;
      countMap.set(analysis.patientId, current + 1);
    });
    
    setPatientInsights(countMap);
  };
  
  loadInsightCounts();
}, []);
```

---

### 3. Add Manual "Analyze Patterns" Button

**File:** `components/patient-library-section.tsx`

**Location:** Patient detail actions (next to "Generate Ficha" button)

```tsx
import { usePatternMirror } from '@/hooks/use-pattern-mirror';

// In component:
const { generateAnalysis, isLoading: isAnalyzing } = usePatternMirror();
const { systemState } = useHopeAISystem();

const handleGenerateInsights = async () => {
  if (!selectedPatient) return;
  
  try {
    setIsGeneratingInsights(true);
    
    // Get session history for this patient
    const sessionHistory = systemState.history.filter(
      msg => msg.clinicalContext?.patientId === selectedPatient.id
    );
    
    if (sessionHistory.length < 3) {
      toast({
        title: "Sesiones insuficientes",
        description: "Se necesitan al menos 3 sesiones para generar insights significativos.",
        variant: "default"
      });
      return;
    }
    
    await generateAnalysis(
      selectedPatient.id,
      selectedPatient.displayName,
      sessionHistory,
      'general' // or detect from patient.demographics.country
    );
    
    toast({
      title: "Análisis iniciado",
      description: "Los insights estarán disponibles en unos momentos.",
      variant: "default"
    });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    toast({
      title: "Error",
      description: "No se pudo generar el análisis de patrones.",
      variant: "destructive"
    });
  } finally {
    setIsGeneratingInsights(false);
  }
};

// In UI:
<Button
  variant="outline"
  size="sm"
  onClick={handleGenerateInsights}
  disabled={isGeneratingInsights || !selectedPatient}
  className="flex items-center gap-2"
>
  {isGeneratingInsights ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Generando...
    </>
  ) : (
    <>
      <Sparkles className="h-4 w-4" />
      Analizar Patrones
    </>
  )}
</Button>
```

---

### 4. Automatic Trigger on Session Milestones

**File:** `lib/hopeai-system.ts`

**Location:** In `sendMessage()` method, after saving chat session

```tsx
// After line ~642: await this.saveChatSessionBoth(currentState)

// Check if this is a milestone session for Pattern Mirror
if (this.shouldTriggerPatternAnalysis(currentState)) {
  this.triggerPatternAnalysisAsync(currentState).catch(error => {
    console.error('Pattern analysis trigger failed:', error);
    // Don't block user flow, just log
  });
}
```

**Helper Methods:**
```tsx
/**
 * Determine if we should trigger pattern analysis
 */
private shouldTriggerPatternAnalysis(chatState: ChatState): boolean {
  const patientId = chatState.clinicalContext?.patientId;
  if (!patientId) return false;
  
  // Count sessions with this patient
  const patientSessions = chatState.history.filter(
    msg => msg.role === 'user' // Count user messages as session markers
  ).length;
  
  // Trigger at sessions 4, 8, 15, 30
  const milestones = [4, 8, 15, 30];
  return milestones.includes(patientSessions);
}

/**
 * Trigger pattern analysis asynchronously
 */
private async triggerPatternAnalysisAsync(chatState: ChatState): Promise<void> {
  const patientId = chatState.clinicalContext?.patientId;
  if (!patientId) return;
  
  console.log(`🔍 [Pattern Mirror] Triggering automatic analysis for patient ${patientId}`);
  
  try {
    // Get patient info
    const { getPatientPersistence } = await import('./patient-persistence');
    const persistence = getPatientPersistence();
    const patient = await persistence.loadPatientRecord(patientId);
    
    if (!patient) {
      console.warn('Patient not found:', patientId);
      return;
    }
    
    // Get all sessions with this patient
    const patientHistory = chatState.history;
    
    // Call API to generate analysis
    await fetch(`/api/patients/${encodeURIComponent(patientId)}/pattern-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionHistory: patientHistory,
        patientName: patient.displayName,
        triggerReason: 'session_milestone',
        culturalContext: 'general'
      })
    });
    
    console.log(`✅ [Pattern Mirror] Automatic analysis triggered successfully`);
    
  } catch (error) {
    console.error('Error triggering pattern analysis:', error);
    Sentry.captureException(error, {
      tags: {
        component: 'pattern-mirror-trigger',
        patient_id: patientId
      }
    });
  }
}
```

---

### 5. Add Session Count Display

**File:** `components/patient-library-section.tsx`

**Enhancement:** Show session count to help psychologist understand when insights will generate

```tsx
<div className="flex items-center gap-2 text-sm text-gray-600">
  <MessageCircle className="h-4 w-4" />
  <span>{sessionCount} sesiones registradas</span>
  
  {sessionCount >= 3 && sessionCount < 4 && (
    <Badge variant="secondary" className="text-xs">
      1 sesión más para primer insight
    </Badge>
  )}
  
  {sessionCount >= 4 && !hasInsights && (
    <Badge variant="outline" className="text-xs text-purple-600">
      Insights disponibles - genera ahora
    </Badge>
  )}
</div>
```

---

## Testing Checklist

### Manual Testing Flow

1. **Create Patient** → Add patient to library
2. **Conduct 4 Sessions** → Send 4+ messages in patient context
3. **Check Trigger** → Verify automatic analysis starts at session 4
4. **View Badge** → Patient Library shows "Nuevo insight" badge
5. **Open Insights** → Click patient → Pattern Insights tab
6. **Verify Content** → See explored domains, reflective questions
7. **Test Feedback** → Submit helpful/not helpful feedback
8. **Test Dismissal** → Dismiss insight, verify badge clears
9. **Manual Generation** → Click "Analizar Patrones" button
10. **Polling** → Verify status updates from generating → completed

### Edge Cases to Test

- [ ] Patient with < 3 sessions (should show "insufficient sessions")
- [ ] Patient with no conversations (should handle gracefully)
- [ ] Multiple analyses for same patient (should show latest)
- [ ] Analysis in progress (should show generating state)
- [ ] Analysis error (should show error state with retry)
- [ ] Empty exploration domains (should handle gracefully)
- [ ] Very long session history (10+ sessions)

---

## Performance Considerations

### IndexedDB Size Management

```tsx
// In pattern-analysis-storage.ts

/**
 * Cleanup old analyses (keep max 10 per patient)
 */
async cleanupOldAnalyses(patientId: string): Promise<void> {
  const analyses = await this.getPatientAnalyses(patientId);
  
  if (analyses.length > 10) {
    const toDelete = analyses.slice(10); // Keep 10 most recent
    
    for (const analysis of toDelete) {
      await this.deleteAnalysis(analysis.analysisId);
    }
    
    console.log(`🧹 Cleaned up ${toDelete.length} old analyses for patient ${patientId}`);
  }
}
```

### Analysis Timeouts

```tsx
// In API route
const ANALYSIS_TIMEOUT = 3 * 60 * 1000; // 3 minutes

setTimeout(() => {
  // If analysis not complete, mark as timeout error
  storage.loadAnalysis(analysisId).then(state => {
    if (state?.status === 'generating') {
      storage.saveAnalysisState({
        ...state,
        status: 'error',
        error: 'Analysis timeout - please try again'
      });
    }
  });
}, ANALYSIS_TIMEOUT);
```

---

## Rollout Strategy

### Soft Launch (Week 1-2)
- Enable for 5 alpha users only
- Monitor feedback closely
- Iterate on prompts based on quality
- Fix bugs before wider release

### Beta Launch (Week 3-4)
- Enable for 20-30 users
- A/B test different trigger timings (session 3 vs 4 vs 5)
- Collect engagement metrics
- Refine UI based on usage patterns

### General Availability (Month 2)
- Enable for all users
- Monitor server load (LLM costs)
- Track engagement metrics
- Iterate based on data

---

## Monitoring & Analytics

### Events to Track

```tsx
// In PatternMirrorPanel component
import { trackEvent } from '@/lib/analytics';

// When insight viewed
trackEvent('pattern_mirror_viewed', {
  patient_id: patientId,
  analysis_id: analysisId,
  session_count: analysis.sessionCount,
  explored_domains: analysis.exploredDomains.length
});

// When feedback submitted
trackEvent('pattern_mirror_feedback', {
  analysis_id: analysisId,
  helpful: helpful,
  has_comment: !!comment
});

// When dismissed
trackEvent('pattern_mirror_dismissed', {
  analysis_id: analysisId,
  view_count: latestAnalysis.viewCount
});
```

### Key Metrics Dashboard

```
Weekly Review:
- Analyses generated: X
- Analyses viewed: Y (Z% view rate)
- Helpful feedback: W (V% helpful rate)
- Avg time to view: H hours
- Most common explored domains: [list]
- Most valued reflective questions: [list]
```

---

## Next Steps

1. ✅ **Review this guide** - Understand integration points
2. **Start with Step 1** - Add tabs to Ficha Clínica Panel
3. **Test locally** - Verify with test patient
4. **Add Step 2** - Insights badge in Patient Library
5. **Complete Steps 3-4** - Manual button + auto-trigger
6. **Alpha test** - 5 users, 2 weeks, collect feedback
7. **Iterate** - Refine based on real usage
8. **Scale** - Roll out to all users

---

## Questions & Support

**Technical Questions:**
- How does async analysis work? → See API route comments
- How to customize prompts? → `clinical-pattern-analyzer.ts` line 712
- How to adjust triggers? → `hopeai-system.ts` shouldTriggerPatternAnalysis()

**Product Questions:**
- When to show insights? → After session 4, 8, 15, 30
- What if not helpful? → Feedback loop improves over time
- Cultural adaptation? → Pass `culturalContext` param

**Need Help?**
- Review `Pattern_Mirror_Strategic_Blueprint.md` for context
- Check inline comments in all new files
- Test with sample patient data first

---

**Ready to integrate? Start with Step 1. Take it one piece at a time.**

The silent algorithm awaits. 🌟

