"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import type { GraphNode, GraphLink } from "@/lib/api"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

interface Props {
  nodes: GraphNode[]
  links: GraphLink[]
  onNodeClick?: (node: GraphNode) => void
  width?: number
  height?: number
}

export default function KnowledgeGraph({ nodes, links, onNodeClick, width = 700, height = 550 }: Props) {
  const fgRef = useRef<any>(null)
  const frameRef = useRef<number>(0)
  const [tick, setTick] = useState(0)

  // Animate the pulsing ring for decaying nodes
  useEffect(() => {
    let id: ReturnType<typeof setInterval>
    id = setInterval(() => setTick((t) => t + 1), 50)
    return () => clearInterval(id)
  }, [])

  // Zoom to fit after mount
  useEffect(() => {
    const t = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(600, 60)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [nodes, links])

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name as string
      const state = node.state_label as string
      const color = node.color as string
      const r = (node.size || 6) / 2
      const x = node.x ?? 0
      const y = node.y ?? 0

      // Glow / shadow
      if (state === "solid") {
        ctx.shadowBlur = 12
        ctx.shadowColor = "#22c55e"
      } else if (state === "decaying") {
        ctx.shadowBlur = 10
        ctx.shadowColor = "#ef4444"
      } else if (state === "overconfident") {
        ctx.shadowBlur = 10
        ctx.shadowColor = "#f59e0b"
      } else if (state === "learning") {
        ctx.shadowBlur = 8
        ctx.shadowColor = "#a855f7"
      } else {
        ctx.shadowBlur = 0
      }

      // Main node circle
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
      ctx.shadowBlur = 0

      // Pulsing outer ring for decaying
      if (state === "decaying") {
        const phase = (tick % 40) / 40  // 0..1
        const pulseR = r + 3 + Math.sin(phase * Math.PI * 2) * 2
        const alpha = 0.4 + Math.sin(phase * Math.PI * 2) * 0.3
        ctx.beginPath()
        ctx.arc(x, y, pulseR, 0, 2 * Math.PI)
        ctx.strokeStyle = `rgba(239,68,68,${alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Amber warning border for overconfident
      if (state === "overconfident") {
        ctx.beginPath()
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI)
        ctx.strokeStyle = "#f59e0b"
        ctx.lineWidth = 2
        ctx.stroke()
        // Warning badge
        ctx.fillStyle = "#f59e0b"
        ctx.font = `bold ${Math.max(5, 8 / globalScale)}px sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("!", x + r * 0.7, y - r * 0.7)
      }

      // Label below node
      const fontSize = Math.max(4, 10 / globalScale)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillStyle = "rgba(255,255,255,0.75)"
      ctx.fillText(label, x, y + r + 2)
    },
    [tick]
  )

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const start = link.source as GraphNode
    const end = link.target as GraphNode
    if (!start?.x || !end?.x) return

    const sx = start.x ?? 0
    const sy = start.y ?? 0
    const ex = end.x ?? 0
    const ey = end.y ?? 0

    if (link.link_type === "transfer") {
      // Dashed blue arrow for transfer
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = "rgba(59,130,246,0.6)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.restore()
    } else {
      // Solid gray for prerequisite
      ctx.strokeStyle = "rgba(107,114,128,0.4)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
    }
  }, [])

  if (!nodes.length) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50"
        style={{ width, height }}
      >
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-3">🧠</div>
          <div className="text-sm">Knowledge graph loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#080d1a]">
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={width}
        height={height}
        backgroundColor="#080d1a"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => "replace"}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        onNodeClick={(node) => onNodeClick?.(node as GraphNode)}
        nodeLabel=""
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        d3VelocityDecay={0.3}
        cooldownTicks={200}
      />
    </div>
  )
}
