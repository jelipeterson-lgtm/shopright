import { useNavigate } from 'react-router-dom'

function PageHeader({ title, subtitle, size = 'default' }) {
  const navigate = useNavigate()
  const logoSize = size === 'small' ? 'w-8 h-8' : 'w-10 h-10'
  const textSize = size === 'small' ? 'text-base' : 'text-lg'

  return (
    <div className="bg-gray-50 px-6 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <img
          src="/Logo.png"
          alt="ShopRight"
          className={`${logoSize} rounded-lg cursor-pointer`}
          onClick={() => navigate('/app')}
        />
        <div>
          <h1 className={`${textSize} font-bold text-gray-900`}>{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
