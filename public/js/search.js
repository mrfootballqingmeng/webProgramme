// 搜索功能的JavaScript代码

class SearchManager {
    constructor() {
        this.searchInput = document.querySelector('.search-input');
        this.topicFilter = document.querySelector('.topic-filter');
        this.searchResults = document.querySelector('.search-results');
        this.searchStats = document.querySelector('.search-stats');
        this.debounceTimer = null;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 实时搜索（防抖）
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.performSearch();
                }, 500); // 500ms 防抖
            });
        }
        
        // 话题筛选
        if (this.topicFilter) {
            this.topicFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }
        
        // 搜索表单提交
        const searchForm = document.querySelector('.search-form form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performSearch();
            });
        }
        
        // 绑定帖子交互事件
        this.bindPostInteractions();
    }
    
    async performSearch() {
        const query = this.searchInput?.value.trim() || '';
        const topic = this.topicFilter?.value || '';
        
        if (!query) {
            this.showEmptyState();
            return;
        }
        
        try {
            this.showLoading();
            
            const params = new URLSearchParams();
            params.append('q', query);
            if (topic) params.append('topic', topic);
            
            const response = await fetch(`/api/search?${params}`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayResults(data.posts, data.total, query, topic);
            } else {
                this.showError('搜索失败，请稍后重试');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('网络错误，请检查连接');
        }
    }
    
    displayResults(posts, total, query, topic) {
        if (!this.searchResults) return;
        
        // 更新统计信息
        if (this.searchStats) {
            let statsText = `找到 ${total} 个相关帖子`;
            if (topic) {
                const topicOption = this.topicFilter.querySelector(`option[value="${topic}"]`);
                const topicName = topicOption ? topicOption.textContent : topic;
                statsText += ` 在话题 "${topicName}" 中`;
            }
            this.searchStats.textContent = statsText;
        }
        
        // 清空现有结果
        const existingPosts = this.searchResults.querySelectorAll('.post-card');
        existingPosts.forEach(post => post.remove());
        
        if (posts.length === 0) {
            this.showNoResults();
            return;
        }
        
        // 渲染搜索结果
        posts.forEach(post => {
            const postElement = this.createPostElement(post, query);
            this.searchResults.appendChild(postElement);
        });
        
        // 重新绑定交互事件
        this.bindPostInteractions();
    }
    
    createPostElement(post, query) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-card';
        
        // 高亮搜索关键词
        const highlightedContent = this.highlightText(post.content, query);
        
        // 处理文件显示
        let filesHtml = '';
        if (post.files && post.files.length > 0) {
            filesHtml = `
                <div class="post-images">
                    ${post.files.map(file => `
                        <img src="${file}" alt="Post image" onerror="this.style.display='none'">
                    `).join('')}
                </div>
            `;
        }
        
        postDiv.innerHTML = `
            <div class="post-header">
                <span class="post-author">@${post.user.name}</span>
                <span class="post-topic">${post.topic_name}</span>
                <span class="post-time">${new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="post-content">
                <p>${highlightedContent}</p>
                ${filesHtml}
            </div>
            <div class="post-actions">
                <button class="btn-like" data-post-id="${post.id}">
                    <i class="fa fa-heart"></i> ${post.likes || 0}
                </button>
                <button class="btn-comment" data-post-id="${post.id}">
                    <i class="fa fa-comment"></i> ${post.comments || 0}
                </button>
                <button class="btn-share" data-post-id="${post.id}">
                    <i class="fa fa-share"></i> ${post.shares || 0}
                </button>
            </div>
        `;
        
        return postDiv;
    }
    
    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    showLoading() {
        if (!this.searchResults) return;
        
        const existingPosts = this.searchResults.querySelectorAll('.post-card');
        existingPosts.forEach(post => post.remove());
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-state';
        loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #657786;">
                <i class="fa fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>搜索中...</p>
            </div>
        `;
        this.searchResults.appendChild(loadingDiv);
    }
    
    showEmptyState() {
        if (!this.searchResults) return;
        
        const existingPosts = this.searchResults.querySelectorAll('.post-card, .loading-state, .no-results');
        existingPosts.forEach(element => element.remove());
        
        if (this.searchStats) {
            this.searchStats.textContent = '输入关键词开始搜索';
        }
    }
    
    showNoResults() {
        const existingPosts = this.searchResults.querySelectorAll('.post-card, .loading-state');
        existingPosts.forEach(element => element.remove());
        
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.innerHTML = `
            <i class="fa fa-search" style="font-size: 48px; margin-bottom: 20px; color: #ccc;"></i>
            <h3>没有找到相关结果</h3>
            <p>尝试使用不同的关键词或检查拼写</p>
        `;
        this.searchResults.appendChild(noResultsDiv);
    }
    
    showError(message) {
        if (!this.searchResults) return;
        
        const existingPosts = this.searchResults.querySelectorAll('.post-card, .loading-state');
        existingPosts.forEach(element => element.remove());
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state';
        errorDiv.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fa fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>搜索出错</h3>
                <p>${message}</p>
            </div>
        `;
        this.searchResults.appendChild(errorDiv);
    }
    
    bindPostInteractions() {
        // 点赞功能
        document.querySelectorAll('.btn-like').forEach(btn => {
            btn.addEventListener('click', async function() {
                const postId = this.dataset.postId;
                try {
                    const response = await fetch(`/api/posts/${postId}/like`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (data.likes !== undefined) {
                        this.innerHTML = `<i class="fa fa-heart"></i> ${data.likes}`;
                        if (data.liked) {
                            this.style.color = '#e91e63';
                        } else {
                            this.style.color = '#657786';
                        }
                    }
                } catch (error) {
                    console.error('点赞失败:', error);
                }
            });
        });
    }
}

// 页面加载完成后初始化搜索管理器
document.addEventListener('DOMContentLoaded', function() {
    new SearchManager();
});
