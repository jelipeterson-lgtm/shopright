import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

const steps = [
  {
    title: 'Welcome to ShopRight',
    content: 'ShopRight helps you record store visits, fill out vendor assessments, and generate reports — all from your phone. This guide walks you through everything.',
    dos: [],
    donts: [],
  },
  {
    title: 'Step 1: Start Your Shopping Day',
    content: 'From the Home page, tap "Start Shopping" to go to the Stores page. This is where you\'ll manage all your store visits for the day.',
    dos: [
      'Start your session before arriving at the first store',
      'Make sure GPS/location is enabled on your phone',
    ],
    donts: [
      'Don\'t worry about ending a session — just close each store when done',
    ],
  },
  {
    title: 'Step 2: Add a Store',
    content: 'Tap "Add Store" on the Stores page. The app will try to find nearby stores using GPS. If your store doesn\'t appear, tap "Search instead" and search by store number or retailer name.',
    dos: [
      'Allow location access when prompted for faster store finding',
      'Search by store number (e.g., "63") for the fastest results',
      'Verify the store address matches where you are',
    ],
    donts: [
      'Don\'t select the wrong store — check the address before confirming',
      'Don\'t open a new store before closing your current one',
    ],
  },
  {
    title: 'Step 3: Add a Vendor',
    content: 'After confirming a store, enter the vendor program code (e.g., RTL-ATT-EDM). The known program will auto-fill, but you can type any program code. Tap "Confirm Store & Add Vendor" to open the assessment form.',
    dos: [
      'Double-check the vendor program code is correct',
      'You can add multiple vendors at the same store',
    ],
    donts: [
      'Don\'t leave the program field empty',
    ],
  },
  {
    title: 'Step 4: Fill Out the Assessment',
    content: 'The assessment form has three sections:\n\n1. Reps Present — Are reps at the store? Pass or Fail.\n2. Evaluation Fields — 12 questions, all default to Pass. Only tap Fail or N/A for exceptions.\n3. Visit Recap — Describe the overall visit.',
    dos: [
      'Set "Reps Present" first — it controls the rest of the form',
      'If Reps Present = Pass, enter the rep count (required)',
      'Use the microphone button for voice input on any text field',
      'Scroll through the evaluation fields — only change what needs changing',
      'Write a clear Visit Recap — Smart Circle reads this',
    ],
    donts: [
      'Don\'t skip the rep count when reps are present',
      'Don\'t mark Fail without adding a comment — it\'s required',
      'Don\'t worry about losing work — the form auto-saves every change',
      'Don\'t rush the Visit Recap — it\'s the most important field',
    ],
  },
  {
    title: 'Step 5: Submit the Assessment',
    content: 'Tap "Review & Submit" at the bottom. If AI Review is enabled, the AI will check your notes for issues. If it finds anything, you\'ll see flagged items highlighted in yellow.\n\nYou can edit the flagged fields, tap "Review with AI Again" for a fresh check, or tap "Submit Anyway" to skip.',
    dos: [
      'Review AI flags — they often catch real issues',
      'Edit your notes if the AI question makes sense',
      'Tap "Submit Anyway" if you\'re confident your notes are fine',
    ],
    donts: [
      'Don\'t panic if the AI flags something — it\'s just asking questions',
      'Don\'t ignore every flag — some may be legitimate issues',
    ],
  },
  {
    title: 'Step 6: Add More Vendors or Close the Store',
    content: 'After submitting, you\'re back on the Stores page. You can:\n\n• "Add Another Vendor" — add another vendor program at the same store\n• "Close Store" — mark this store as done\n\nYou must close a store before adding a new one.',
    dos: [
      'Add all vendors at a store before closing it',
      'Close the store when you\'re done with all vendors there',
    ],
    donts: [
      'Don\'t try to add a new store before closing the current one',
      'Don\'t close a store if you still have open (unsubmitted) vendors',
    ],
  },
  {
    title: 'Step 7: Send Your Weekly Report',
    content: 'At the end of the week, tap "Reports" in the bottom nav, then "Weekly Shop File". You\'ll see all your completed vendors for the week grouped by day.\n\nReview them, enter the recipient email, and tap "Send Shop File". The report is an Excel file emailed directly to Smart Circle.',
    dos: [
      'Review your vendors before sending — you can tap any to edit',
      'Send the report at the end of your last shopping day of the week',
      'Check your email to confirm the report was sent',
    ],
    donts: [
      'Don\'t send the report before all vendors for the week are submitted',
      'Don\'t change the file format — it matches Smart Circle\'s template exactly',
    ],
  },
  {
    title: 'Step 8: Send Your Monthly Invoice',
    content: 'At the end of the month, tap "Reports" > "Monthly Invoice". You\'ll see all vendors grouped by day with a mileage field for each shopping day.\n\nEnter your miles driven each day. Pricing is automatic:\n• $50 for the first vendor at each store per day\n• $15 for each additional vendor at the same store\n\nTap "Generate & Send Invoice" to email it.',
    dos: [
      'Enter mileage for every shopping day',
      'Double-check the pricing totals make sense',
      'Send the invoice at the end of each month',
    ],
    donts: [
      'Don\'t forget to enter mileage — it\'s not calculated automatically',
      'Don\'t send the invoice before the month is complete',
    ],
  },
  {
    title: 'Setting Up AI Review (Optional)',
    content: 'AI Review checks your assessment notes before submission, catching unclear or contradictory statements. It\'s optional but recommended.\n\nTo set up:\n1. Go to Settings\n2. Tap "Enable" under AI Review\n3. Go to console.anthropic.com in your browser\n4. Create an account and add $5 credits\n5. Go to API Keys > Create Key > name it "ShopRight"\n6. Copy the key, paste it in Settings\n7. Test the connection, then Save',
    dos: [
      'Set up AI Review — it catches mistakes you\'ll miss',
      'Add at least $5 in credits to your Anthropic account',
      'Copy the API key immediately — you can\'t see it again',
    ],
    donts: [
      'Don\'t share your API key with anyone',
      'Don\'t worry about cost — typical usage is $1-3/month',
      'Don\'t skip this just because it seems technical — follow the steps above',
    ],
  },
  {
    title: 'Tips & Tricks',
    content: 'A few things to make your life easier:',
    dos: [
      'Use voice input — tap the mic icon next to any text field',
      'Tap the ShopRight logo on any page to go Home',
      'Use the bottom nav bar to jump between pages',
      'Tap the blue ? button for AI-powered help on any page',
      'Add the app to your home screen for quick access (Share > Add to Home Screen)',
      'Your work auto-saves — close the browser anytime without losing data',
    ],
    donts: [
      'Don\'t use the browser back button — use the in-app navigation instead',
      'Don\'t delete a vendor by accident — the confirmation dialog is there for a reason',
      'Don\'t forget to close each store before moving to the next',
    ],
  },
  {
    title: 'You\'re Ready!',
    content: 'That\'s everything you need to know. Start shopping, fill out assessments, and send your reports. If you need help, tap the ? button on any page.\n\nHappy shopping!',
    dos: [],
    donts: [],
  },
]

function Tutorial() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Getting Started"
        rightButton={
          <button onClick={() => navigate('/app')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">
            Skip
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
          <p className="text-xs text-blue-600 font-medium mb-1">
            {currentStep + 1} of {steps.length}
          </p>
          <h2 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{step.content}</p>
        </div>

        {/* Do's */}
        {step.dos.length > 0 && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 mb-3">
            <p className="text-xs font-semibold text-green-700 mb-2">DO</p>
            <ul className="space-y-1.5">
              {step.dos.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-green-800">
                  <span className="text-green-500 flex-shrink-0">+</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Don'ts */}
        {step.donts.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-6">
            <p className="text-xs font-semibold text-red-700 mb-2">DON'T</p>
            <ul className="space-y-1.5">
              {step.donts.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-red-800">
                  <span className="text-red-500 flex-shrink-0">-</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-300"
            >
              Back
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => navigate('/app')}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              Start Shopping
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tutorial
