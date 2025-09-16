// 主页搜索功能

class HomeSearchManager {
    constructor() {
        this.searchInput = document.querySelector('.quick-search input[name="q"]');
        this.searchForm = document.querySelector('.quick-search form');
        this.suggestionsContainer = null;
        this.debounceTimer = null;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        
        this.initSearchFeatures();
    }
    
    initSearchFeatures() {
        if (!this.searchInput) return;
        
        // 创建建议容器
        this.createSuggestionsContainer();
        
        // 绑定事件
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.fetchSuggestions(e.target.value);
            }, 300);
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });
        
        this.searchInput.addEventListener('focus', () => {
            if (this.currentSuggestions.length > 0) {
                this.showSuggestions();
            }
        });
        
        this.searchInput.addEventListener('blur', () => {
            // 延迟隐藏，允许点击建议
            setTimeout(() => {
                this.hideSuggestions();
            }, 200);
        });
        
        // 表单提交处理
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', (e) => {
                const query = this.searchInput.value.trim();
                if (!query) {
                    e.preventDefault();
                    this.searchInput.focus();
                }
            });
        }
        
        // 点击页面其他地方隐藏建议
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && 
                !this.suggestionsContainer.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }
    
    createSuggestionsContainer() {
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'search-suggestions';
        this.suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #e1e8ed;
            border-top: none;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;
        
        // 设置搜索框容器为相对定位
        const searchContainer = this.searchInput.closest('.quick-search');
        if (searchContainer) {
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(this.suggestionsContainer);
        }
    }
    
    async fetchSuggestions(query) {
        if (!query || query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        try {
            const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (response.ok && data.suggestions) {
                this.currentSuggestions = data.suggestions;
                this.renderSuggestions(query);
            }
        } catch (error) {
            console.error('获取搜索建议失败:', error);
        }
    }
    
    renderSuggestions(query) {
        if (this.currentSuggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsContainer.innerHTML = '';
        this.selectedIndex = -1;
        
        this.currentSuggestions.forEach((suggestion, index) => {
            const suggestionElement = document.createElement('div');
            suggestionElement.className = 'suggestion-item';
            suggestionElement.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                border-bottom: 1px solid #f0f0f0;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.2s;
            `;
            
            // 图标根据类型显示
            const icon = suggestion.type === 'user' ? 
                '<i class="fa fa-user" style="color: #1da1f2;"></i>' : 
                '<i class="fa fa-file-text" style="color: #657786;"></i>';
            
            // 高亮匹配的文本
            const highlightedText = this.highlightMatch(suggestion.text, query);
            
            suggestionElement.innerHTML = `
                ${icon}
                <span style="flex: 1;">${highlightedText}</span>
                <span style="font-size: 12px; color: #657786;">${suggestion.type === 'user' ? '用户' : '帖子'}</span>
            `;
            
            // 鼠标悬停效果
            suggestionElement.addEventListener('mouseenter', () => {
                this.selectSuggestion(index);
            });
            
            // 点击选择
            suggestionElement.addEventListener('click', () => {
                this.applySuggestion(suggestion);
            });
            
            this.suggestionsContainer.appendChild(suggestionElement);
        });
        
        this.showSuggestions();
    }
    
    highlightMatch(text, query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<strong style="color: #1da1f2;">$1</strong>');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    handleKeyNavigation(e) {
        if (!this.suggestionsContainer.style.display || 
            this.suggestionsContainer.style.display === 'none') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
                this.updateSelection();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
                
            case 'Enter':
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.applySuggestion(this.currentSuggestions[this.selectedIndex]);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }
    
    selectSuggestion(index) {
        this.selectedIndex = index;
        this.updateSelection();
    }
    
    updateSelection() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.style.backgroundColor = '#f7f9fa';
            } else {
                item.style.backgroundColor = 'white';
            }
        });
    }
    
    applySuggestion(suggestion) {
        let searchQuery = suggestion.text;
        
        // 如果是用户建议，添加@前缀
        if (suggestion.type === 'user') {
            searchQuery = suggestion.text;
        }
        
        this.searchInput.value = searchQuery;
        this.hideSuggestions();
        
        // 自动提交搜索
        if (this.searchForm) {
            this.searchForm.submit();
        }
    }
    
    showSuggestions() {
        this.suggestionsContainer.style.display = 'block';
    }
    
    hideSuggestions() {
        this.suggestionsContainer.style.display = 'none';
        this.selectedIndex = -1;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    new HomeSearchManager();
});
