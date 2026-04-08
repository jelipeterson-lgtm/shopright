import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

function HelpGuide() {
  const navigate = useNavigate()

  const sections = [
    {
      title: 'Getting Started',
      items: [
        { q: 'How do I start shopping?', a: 'From the Home page, tap "Start Shopping". This takes you to the Stores page where you can add your first store.' },
        { q: 'How do I add a store?', a: 'Tap "Add Store" on the Stores page. Allow GPS to find nearby stores, or search by store number or retailer name. Select the store and confirm.' },
        { q: 'How do I add a vendor?', a: 'After selecting a store, choose a vendor program from the dropdown (e.g., RTL-ATT-EDM). If your program isn\'t listed, select "Other (enter manually)" and type it. Tap "Confirm Store & Add Vendor" to open the assessment form.' },
        { q: 'How do I add another vendor at the same store?', a: 'On the Stores page, tap "Add Another Vendor" under the store. Select the program from the dropdown and fill out the form.' },
        { q: 'What if my vendor program isn\'t in the dropdown?', a: 'Select "Other (enter manually)" at the bottom of the program dropdown. You can type any program code. Tap "Back to program list" if you want to switch back to the dropdown.' },
      ],
    },
    {
      title: 'Assessment Form',
      items: [
        { q: 'What is the Reps Present field?', a: 'This is a gate field. If reps are present, select Pass and fill out the full form. If no reps are present, select Fail — the form will skip to Visit Recap.' },
        { q: 'What do Pass, Fail, and N/A mean?', a: 'Pass = everything is fine (default). Fail = there\'s an issue (requires a comment). N/A = not applicable to this vendor or store.' },
        { q: 'What is the Visit Recap?', a: 'A text field at the bottom of every assessment where you describe the overall store visit. This is the main narrative Smart Circle reads.' },
        { q: 'Can I use voice input?', a: 'Yes! Tap the microphone icon next to any text field to speak instead of type. Works in Chrome on all devices.' },
        { q: 'What if I close the browser mid-form?', a: 'Your work auto-saves every time you change a field. Reopen the app and your data will be there.' },
      ],
    },
    {
      title: 'AI Review',
      items: [
        { q: 'What is AI Review?', a: 'An optional feature that reviews your assessment notes before submission, flagging anything unclear or contradictory. It uses your own Anthropic API key.' },
        { q: 'How do I set up AI Review?', a: 'Go to Settings > AI Review > tap Enable. You\'ll need an Anthropic account with an API key. Follow the step-by-step instructions shown on screen.' },
        { q: 'How do I get an Anthropic API key?', a: '1. Go to console.anthropic.com\n2. Create an account or sign in\n3. Add credits ($5 minimum — lasts months)\n4. Go to API Keys in the left sidebar\n5. Click Create Key, name it "ShopRight"\n6. Copy the key and paste it in Settings' },
        { q: 'Is AI Review required?', a: 'No. The app works perfectly without it. When you tap "Review & Submit" without an API key, it skips AI review and submits directly.' },
        { q: 'How much does AI Review cost?', a: 'Typically $1–3 per month on your own Anthropic account. You need a minimum of $5 in credits to start.' },
      ],
    },
    {
      title: 'Route Planning',
      items: [
        { q: 'How do I plan my route for the day?', a: 'Paste your event email or SMS check-in text, filter by distance or city, optimize, and accept the route. The planner will parse your stores and build an optimized driving order.' },
        { q: 'What does "Accept Route" do?', a: 'Creates Draft vendor visits on the Stores tab for each store in your route. You can then assess each vendor from there.' },
        { q: 'How do I start an assessment from the Route tab?', a: 'Tap "Assess Vendors" on any store to go to the Stores tab.' },
        { q: 'What happens when I Skip or Remove a store?', a: 'Removes the Draft visits from the Stores tab. Use "Restore" to add them back.' },
        { q: 'How does Re-optimize Route work?', a: 'Recalculates the best route using current time and traffic, skipping stores you already assessed.' },
        { q: 'Do I need a Google Maps API key?', a: 'Yes, set it up in Settings. You need the Distance Matrix API enabled in your Google Cloud Console.' },
      ],
    },
    {
      title: 'Reports & Invoices',
      items: [
        { q: 'How do I send my weekly report?', a: 'From Home, tap "Weekly Shop File" under Reports. Review your completed vendors for the week, enter the recipient email, and tap Send.' },
        { q: 'How do I send my monthly invoice?', a: 'From Home, tap "Monthly Invoice" under Reports. Enter your mileage for each shopping day, review the pricing, and tap Send.' },
        { q: 'How is pricing calculated?', a: '$50 for the first vendor at each store per day. $15 for each additional vendor at the same store on the same day.' },
        { q: 'What format is the report?', a: 'Both the Shop File and Invoice are Excel (.xlsx) files that match Smart Circle\'s required format exactly.' },
      ],
    },
    {
      title: 'Account & Settings',
      items: [
        { q: 'How do I edit my profile?', a: 'Tap Profile in the bottom nav. You can update your name, email, phone, address, and mileage rate.' },
        { q: 'How do I change my password?', a: 'Go to Settings > Password > Change Password.' },
        { q: 'How do I manage my subscription?', a: 'Go to Settings > Subscription. You can view your status and manage your subscription through Stripe.' },
      ],
    },
    {
      title: 'Troubleshooting',
      items: [
        { q: '"Load failed" error', a: 'The server may be starting up. Wait 30 seconds and try again. If it persists, check your internet connection.' },
        { q: 'GPS not finding stores', a: 'Make sure location access is enabled in your browser settings. You can also search by store number or retailer name instead.' },
        { q: 'Voice input not working', a: 'Voice input only works in Chrome. Make sure microphone access is enabled in your browser settings.' },
        { q: 'Can\'t find my store', a: 'Try searching by store number (e.g., "63") or retailer name (e.g., "costco"). The store directory is updated periodically.' },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Help Guide" rightButton={<button onClick={() => navigate('/settings')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Back</button>} />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">{section.title}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                    {item.q}
                    <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-3 text-sm text-gray-500 whitespace-pre-line">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-xs text-gray-400 py-4">
          Still need help? Tap the <span className="text-blue-600">?</span> button on any page to chat with our AI assistant.
        </p>
      </div>
    </div>
  )
}

export default HelpGuide
