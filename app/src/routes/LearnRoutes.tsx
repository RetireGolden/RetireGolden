import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { LearningCenterPage } from '../learn/LearningCenterPage'
import { ArticlePage } from '../learn/ArticlePage'
import { GlossaryPage } from '../learn/GlossaryPage'
import { SourcesPage } from '../learn/SourcesPage'
import '../learn/learn.css'

function ScrollToLearnTarget() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      let targetId = hash.slice(1)
      try {
        targetId = decodeURIComponent(targetId)
      } catch {
        // Malformed external hashes should still land at a useful reading position.
      }

      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView()
        return
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [hash, pathname])

  return null
}

export default function LearnRoutes() {
  return (
    <>
      <ScrollToLearnTarget />
      <Routes>
        <Route index element={<LearningCenterPage />} />
        <Route path="glossary" element={<GlossaryPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path=":slug" element={<ArticlePage />} />
      </Routes>
    </>
  )
}
