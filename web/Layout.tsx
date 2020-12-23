import React, { ReactNode } from 'react'
import Head from 'next/head'
import styles from './styles.module.css'

type Props = {
  children?: ReactNode
  title?: string
}

const Layout = ({ children, title = '' }: Props) => (
  <div className={styles.font}>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    {children}
  </div>
)

export default Layout
