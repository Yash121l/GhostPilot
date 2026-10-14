/* PostHog analytics for the GhostPilot website (ghostpilot.yashlunawat.com).
 * Website only: the GhostPilot desktop app itself sends no telemetry.
 * Static GitHub Pages hosting, so there is no reverse proxy: events go straight to PostHog US cloud.
 * The key below is PostHog's public client key (phc_), safe to ship in client code.
 */
;(function () {
  var POSTHOG_KEY = 'phc_oLm8fb7L4CXDqGdJcc7a6boCtR8rVjf6dNx7G995eGdy'
  var APP_SLUG = 'ghostpilot'

  // Skip on localhost / file previews unless explicitly forced with ?ph_dev=1
  var host = location.hostname
  var isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  if (isLocal && !/[?&]ph_dev=1\b/.test(location.search)) return

  // Official PostHog loader snippet (loads array.js from us-assets.i.posthog.com)
  !(function (t, e) {
    var o, n, p, r
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split('.')
          ;(2 == o.length && ((t = t[o[0]]), (e = o[1])),
            (t[e] = function () {
              t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
            }))
        }
        ;(((p = t.createElement('script')).type = 'text/javascript'),
          (p.crossOrigin = 'anonymous'),
          (p.async = !0),
          (p.src =
            s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js'),
          (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r))
        var u = e
        for (
          void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
            u.people = u.people || [],
            Object.defineProperty(u, 'toString', {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              value: function (t) {
                var e = 'posthog'
                return ('posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e)
              }
            }),
            Object.defineProperty(u.people, 'toString', {
              configurable: !0,
              enumerable: !0,
              writable: !0,
              value: function () {
                return u.toString(1) + '.people (stub)'
              }
            }),
            o =
              'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(
                ' '
              ),
            n = 0;
          n < o.length;
          n++
        )
          g(u, o[n])
        e._i.push([i, s, a])
      }),
      (e.__SV = 1))
  })(document, window.posthog || [])

  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-08-30',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    capture_exceptions: true,
    capture_performance: { web_vitals: true },
    session_recording: { maskAllInputs: true }
  })
  posthog.register({ app: APP_SLUG })

  // ── Custom events ────────────────────────────────────────────────────────────
  var page = location.pathname.indexOf('/releases') === 0 ? 'releases' : 'home'

  function detectedOs() {
    var ua = navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform
    if (/mac/i.test(ua)) return 'macos'
    if (/win/i.test(ua)) return 'windows'
    if (/linux/i.test(ua)) return 'linux'
    return 'other'
  }

  function packageInfo(file) {
    var m =
      /GhostPilot-([0-9][^-]*?)(?:[-.](arm64|x64|amd64|setup|portable))?\.(dmg|exe|AppImage|deb|zip|tar\.gz)$/.exec(
        file
      )
    if (!m) return { file: file }
    var ext = m[3]
    var platform = ext === 'dmg' ? 'macos' : ext === 'exe' ? 'windows' : 'linux'
    var variant = m[2] || ''
    var arch = variant === 'arm64' ? 'arm64' : 'x64'
    return {
      file: file,
      version: m[1],
      platform: platform,
      arch: arch,
      package: ext + (variant === 'portable' ? '-portable' : '')
    }
  }

  function linkLocation(a) {
    if (a.id === 'hero-download') return 'hero'
    if (a.id === 'nav-download' || a.closest('nav')) return 'nav'
    if (a.closest('footer')) return 'footer'
    var section = a.closest('section')
    if (section && section.id) return section.id
    if (section && section.classList.contains('cta-section')) return 'cta'
    return 'body'
  }

  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null
      if (!a) return
      var href = a.getAttribute('href') || ''
      var where = linkLocation(a)

      // The hero/nav buttons are rewritten to a direct file link by the page's OS detection script
      var dl = /\/releases\/(?:latest\/)?download\/(?:[^/]+\/)?(GhostPilot-[^/?#]+)$/.exec(href)
      if (dl) {
        var info = packageInfo(dl[1])
        info.location = where
        info.page = page
        info.detected_os = detectedOs()
        posthog.capture('download_clicked', info)
        return
      }
      if (/github\.com\/yash121l\/GhostPilot\/releases\/?(latest)?\/?$/i.test(href)) {
        posthog.capture('download_clicked', {
          location: where,
          page: page,
          detected_os: detectedOs(),
          package: 'releases_page'
        })
        return
      }
      if (href.indexOf('ghostpilot://') === 0) {
        posthog.capture('app_open_clicked', { page: page })
        return
      }
      if (/github\.com\/yash121l\/GhostPilot/i.test(href)) {
        var target = /\/issues/.test(href)
          ? 'issues'
          : /SETUP\.md/i.test(href)
            ? 'setup_guide'
            : /\/releases/.test(href)
              ? 'releases'
              : 'repo'
        posthog.capture('github_clicked', { target: target, location: where, page: page })
      }
    },
    true
  )

  // FAQ: <details> toggled open
  document.addEventListener(
    'toggle',
    function (e) {
      var d = e.target
      if (!d || d.tagName !== 'DETAILS' || !d.open) return
      var s = d.querySelector('summary')
      posthog.capture('faq_opened', {
        question: s ? s.textContent.trim().slice(0, 120) : '',
        page: page
      })
    },
    true
  )

  // Section reach: fires once per section per page view
  function watchSections() {
    if (!('IntersectionObserver' in window)) return
    var seen = {}
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          var id = en.target.id
          if (!en.isIntersecting || seen[id]) return
          seen[id] = true
          posthog.capture('section_viewed', { section: id, page: page })
          io.unobserve(en.target)
        })
      },
      { threshold: 0.35 }
    )
    document.querySelectorAll('section[id]').forEach(function (s) {
      io.observe(s)
    })
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', watchSections)
  else watchSections()
})()
