import { useNavigate } from 'react-router-dom'

function PageHeader({ title, subtitle, rightButton }) {
  const navigate = useNavigate()

  return (
    <div className="bg-gray-50 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/Logo.png"
            alt="ShopRight"
            className="w-9 h-9 rounded-lg cursor-pointer"
            onClick={() => navigate('/app')}
          />
          <div>
            <h1 className="text-base font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {rightButton}
      </div>
    </div>
  )
}

export default PageHeader
