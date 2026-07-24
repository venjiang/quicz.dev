// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://quicz.dev',
	integrations: [
		starlight({
			title: 'quicz',
			description: 'IETF QUIC transport implementation in pure Zig',
			logo: {
				replacesTitle: false,
				alt: 'quicz',
				light: './src/assets/logo.svg',
				dark: './src/assets/logo.svg',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/venjiang/quicz' },
			],
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				'zh-cn': { label: '简体中文', lang: 'zh-CN' },
			},
			editLink: {
				baseUrl: 'https://github.com/venjiang/quicz.dev/edit/main/',
			},
			sidebar: [
				{
					label: 'Start here',
					translations: { 'zh-CN': '从这里开始' },
					items: [
						{ label: 'Quick start', slug: 'quick-start', translations: { 'zh-CN': '快速开始' } },
						{ label: 'Architecture', slug: 'architecture', translations: { 'zh-CN': '架构' } },
						{ label: 'Spec coverage', slug: 'spec', translations: { 'zh-CN': '规范覆盖' } },
					],
				},
				{
					label: 'Examples',
					translations: { 'zh-CN': '示例' },
					items: [{ label: 'Run the examples', slug: 'examples', translations: { 'zh-CN': '运行示例' } }],
				},
				{
					label: 'Status',
					translations: { 'zh-CN': '状态' },
					items: [
						{
							label: 'Task matrix',
							link: 'https://github.com/venjiang/quicz/blob/main/docs/en/quic_transport_tasks.md',
							translations: { 'zh-CN': '任务矩阵' },
						},
						{
							label: 'Interop matrix',
							link: 'https://github.com/venjiang/quicz/tree/main/examples/interop',
							translations: { 'zh-CN': '互操作矩阵' },
						},
					],
				},
			],
		}),
	],
});
