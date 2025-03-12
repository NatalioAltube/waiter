import type React from "react"

interface Order {
  item: string
  quantity: number
  price: number
}

interface OrderPanelProps {
  orders: Order[]
  clientId: string
}

const OrderPanel: React.FC<OrderPanelProps> = ({ orders, clientId }) => {
  // Calcular el total
  const total = orders.reduce((sum, order) => sum + order.price * order.quantity, 0)

  return (
    <div className="h-full bg-white p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-2 text-center">Comanda</h2>
      <div className="text-sm text-gray-500 mb-4 text-center">Cliente: {clientId}</div>

      {orders.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-gray-500">No hay pedidos aún</div>
      ) : (
        <div className="flex-grow overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Plato</th>
                <th className="text-center py-2">Cant.</th>
                <th className="text-right py-2">Precio</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2">{order.item}</td>
                  <td className="text-center py-2">{order.quantity}</td>
                  <td className="text-right py-2">{(order.price * order.quantity).toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex justify-between font-bold">
          <span>Total:</span>
          <span>{total.toFixed(2)}€</span>
        </div>
      </div>
    </div>
  )
}

export default OrderPanel



