function PageHeader({ title, subtitle, size = 'default' }) {
  const logoSize = size === 'small' ? 'w-8 h-8' : 'w-10 h-10'
  const textSize = size === 'small' ? 'text-base' : 'text-lg'

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <img src="/Logo.png" alt="ShopRight" className={`${logoSize} rounded-lg`} />
        <div className="flex items-baseline gap-2">
          <h1 className={`${textSize} font-bold text-gray-900`}>{title}</h1>
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
