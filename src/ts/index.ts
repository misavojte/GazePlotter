import('./initApp')
  .then(
    (module) => {
      module.initApp()
    }
  )
  .catch(
    (error) => {
      console.error(error)
    })

export {}
