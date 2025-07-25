"use client"

import { OverviewMockup } from "@/components/mockups/overview-mockup"
import { SocraticoMockup } from "@/components/mockups/socratico-mockup"
import { ClinicoMockup } from "@/components/mockups/clinico-mockup"
import { AcademicoMockup } from "@/components/mockups/academico-mockup"
import { WorkflowsMockup } from "@/components/mockups/workflows-mockup"
import { MobileMockup } from "@/components/mockups/mobile-mockup"

interface MockupViewerProps {
  currentDemo: string
}

export function MockupViewer({ currentDemo }: MockupViewerProps) {
  const renderMockup = () => {
    switch (currentDemo) {
      case "overview":
        return <OverviewMockup />
      case "socratico":
        return <SocraticoMockup />
      case "clinico":
        return <ClinicoMockup />
      case "academico":
        return <AcademicoMockup />
      case "workflows":
        return <WorkflowsMockup />
      case "mobile":
        return <MobileMockup />
      default:
        return <OverviewMockup />
    }
  }

  return <div className="w-full">{renderMockup()}</div>
}
