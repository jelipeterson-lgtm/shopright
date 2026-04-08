import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

const steps = [
  {
    title: 'Welcome to ShopRight',
    content: 'ShopRight is your all-in-one tool for recording store visits, filling out vendor assessments, and sending reports to Smart Circle — right from your phone.\n\nThis guide walks you through the entire process, step by step.',
    tips: [],
  },
  {
    title: 'Adding a Store',
    content: 'When you arrive at a store, open ShopRight and tap "Start Shopping" on the Home page, then tap "Add Store."\n\nThe app will ask to use your location to find nearby stores. If you allow it, you\'ll see up to 3 stores within 1 mile. Tap the correct one.\n\nIf your store doesn\'t appear, or if you prefer not to use GPS, tap "Search instead" and type the store number (like "63") or retailer name (like "Costco").\n\nOnce you select a store, confirm the address is correct before continuing.',
    tips: [
      'GPS works best when you\'re at or near the store',
      'Searching by store number is the fastest way to find a specific store',
      'You can only have one store open at a time — finish or close your current store before adding another',
    ],
  },
  {
    title: 'Adding a Vendor',
    content: 'After selecting a store, you\'ll see a dropdown with available vendor programs (like RTL-ATT-EDM, RS-CKE, RTL-Jacuzzi-Roadshow, and more).\n\nSelect the program for the vendor you\'re assessing. If the program isn\'t in the list, select "Other (enter manually)" and type it in.\n\nTap "Confirm Store & Add Vendor" to open the assessment form.\n\nYou can add multiple vendors at the same store. After completing one vendor\'s assessment, tap "Add Another Vendor" on the Stores page to add the next one.',
    tips: [
      'Each vendor at a store gets its own assessment form',
      'The program code identifies which vendor or brand you\'re assessing',
      'If your program isn\'t in the dropdown, select "Other" to type it manually',
    ],
  },
  {
    title: 'The Assessment Form — Reps Present',
    content: 'The first question on every assessment is "Reps Present?" — are the vendor\'s representatives at the store?\n\nIf reps ARE present, select Pass. You\'ll then need to:\n• Enter how many reps are present (required)\n• Optionally add their names and descriptions\n\nIf reps are NOT present, select Fail. The form will skip straight to the Visit Recap section at the bottom — just describe what you observed.',
    tips: [
      'This is the most important field — it determines which sections of the form appear',
      'If more than 4 reps are present, you\'ll be asked to explain why (e.g., shift change)',
    ],
  },
  {
    title: 'The Assessment Form — Evaluation Fields',
    content: 'When reps are present, you\'ll see 12 evaluation questions like "Following approved greeting script?" and "Proper dress code?"\n\nEvery field starts at Pass. You only need to interact with fields where something was wrong.\n\n• Tap Fail if there was an issue — a comment box will appear where you describe what happened (required)\n• Tap N/A if the question doesn\'t apply\n• Leave it on Pass if everything was fine\n\nTwo special fields:\n• Soft Selling — only applies to Water programs. Shows as N/A for everything else.\n• Resource Guide — only applies to Costco. Shows as N/A for other retailers.',
    tips: [
      'Think of this as an exception log — you\'re only noting what went wrong',
      'On a good visit, you can scroll past everything without tapping',
      'Use the microphone icon next to any text field to speak instead of type',
    ],
  },
  {
    title: 'The Assessment Form — Visit Recap',
    content: 'At the bottom of every assessment is the Visit Recap — a large text field where you describe the overall visit in your own words.\n\nThis appears on every assessment, whether reps were present or not. Smart Circle reads this section closely, so be clear and specific.\n\nYou can type or use the microphone icon for voice input.',
    tips: [
      'This is the most-read part of your report — take a moment to write clearly',
      'Mention anything noteworthy, even if you marked everything as Pass above',
      'Your form auto-saves every change, so you won\'t lose your work if the browser closes',
    ],
  },
  {
    title: 'Submitting Your Assessment',
    content: 'When you\'re done, tap "Review & Submit" at the bottom of the form.\n\nIf you have AI Review enabled (optional), the app will scan your notes and may flag items that seem unclear or contradictory. Flagged fields will be highlighted in yellow so you can find and edit them.\n\nAfter editing, you can:\n• "Review with AI Again" — run another check on your updated notes\n• "Submit Anyway" — submit as-is if you\'re confident\n• "Cancel Vendor Review" — delete this assessment entirely\n\nIf AI Review is not set up, the assessment submits directly.',
    tips: [
      'AI Review is optional — the app works fine without it',
      'AI flags are questions, not corrections — use your judgment',
      'You can also tap "Save Draft & Go Back" to return later without submitting',
    ],
  },
  {
    title: 'Closing a Store',
    content: 'When you\'ve assessed all vendors at a store, tap "Close Store" on the Stores page.\n\nThe app will check that all vendor assessments at this store have been submitted. If any are still open (not yet submitted), you\'ll need to submit or delete them first.\n\nOnce closed, the store shows as "Completed." You can then add a new store.',
    tips: [
      'You can close a store from anywhere — you don\'t need to be at the store location',
      'A closed store can\'t be reopened, but you can still view completed assessments',
      'You must close your current store before adding a new one',
    ],
  },
  {
    title: 'Adding a Store & Vendor Manually',
    content: 'If you need to add an assessment after the fact — for a store you visited yesterday, or one you forgot to log — tap "Add Store & Vendor Manually" from the Home page or Stores page.\n\nThis lets you search for any store (no GPS required) and set the date and time yourself. The assessment form is exactly the same.',
    tips: [
      'The date defaults to today and time to right now — change them if needed',
      'Manual entries appear in your weekly report based on the date you set',
    ],
  },
  {
    title: 'Sending Your Weekly Report',
    content: 'At the end of your last shopping day each week, tap "Reports" in the bottom menu, then "Weekly Shop File."\n\nYou\'ll see all your completed assessments for the week grouped by day. Review them — you can tap any assessment to make last-minute edits.\n\nEnter the recipient email address and tap "Send Shop File." The report is generated as an Excel file matching Smart Circle\'s exact format and emailed directly.',
    tips: [
      'Make sure all your assessments for the week are submitted before sending',
      'You can also download the file to review it yourself before sending',
      'The file is named "Shop File [Your Name] [Date].xlsx" automatically',
    ],
  },
  {
    title: 'Sending Your Monthly Invoice',
    content: 'At the end of each month, tap "Reports" then "Monthly Invoice."\n\nYou\'ll see all your completed assessments for the month. For each shopping day, enter the total miles you drove in the mileage field.\n\nPricing is calculated automatically:\n• $50 for the first vendor at each store that day\n• $15 for each additional vendor at the same store that day\n\nReview the totals, enter the recipient email, and tap "Generate & Send Invoice."',
    tips: [
      'Enter mileage for every day you shopped — it\'s not tracked automatically',
      'The invoice number is generated automatically based on the year and month',
    ],
  },
  {
    title: 'Setting Up AI Review',
    content: 'AI Review is an optional feature that checks your assessment notes before you submit, catching unclear or contradictory statements.\n\nTo set it up:\n\n1. Go to Settings (bottom menu)\n2. Find "AI Review" and tap Enable\n3. Open console.anthropic.com in your browser\n4. Create a free account\n5. Go to Settings > Billing and add $5 in credits\n6. Go to API Keys (left sidebar)\n7. Tap "Create Key" and name it "ShopRight"\n8. Copy the key immediately — it won\'t be shown again\n9. Go back to ShopRight Settings and paste the key\n10. Tap "Step 1: Test Connection"\n11. When it says "API key is valid!", tap "Step 2: Save API Key"\n\nThat\'s it! AI Review will now run every time you submit an assessment.',
    tips: [
      'The $5 in credits typically lasts 2-3 months of regular use',
      'You can disable AI Review anytime in Settings',
      'The app works perfectly without AI Review — it\'s just an extra safety net',
    ],
  },
  {
    title: 'Helpful Tips',
    content: 'A few things that will make ShopRight easier to use:',
    tips: [
      'Tap the ShopRight logo at the top of any page to go back to Home',
      'Use the bottom menu to navigate: Home, Stores, Reports, Profile, Settings',
      'Tap the blue ? button on any page for instant help from our AI assistant',
      'Use voice input — the microphone icon appears next to every text field',
      'Add ShopRight to your home screen for quick access: tap Share > Add to Home Screen',
      'Your work saves automatically — you can close the browser anytime without losing anything',
      'If the app seems slow on first load, wait 30 seconds — the server may be waking up',
    ],
  },
  {
    title: 'You\'re All Set!',
    content: 'You now know everything you need to use ShopRight. Here\'s the quick version:\n\n1. Add a store when you arrive\n2. Add a vendor and fill out the assessment\n3. Submit, then add more vendors or close the store\n4. Send your weekly report on your last shopping day\n5. Send your monthly invoice at the end of the month\n\nIf you ever get stuck, tap the ? button for help. Happy shopping!',
    tips: [],
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
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">
            Close
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

        {/* Tips */}
        {step.tips.length > 0 && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-6">
            <p className="text-xs font-semibold text-blue-700 mb-2">Good to know</p>
            <ul className="space-y-2">
              {step.tips.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-blue-800">
                  <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
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
