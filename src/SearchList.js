/**
 * Created by haywoodfu on 17/4/16.
 */

import {
  View,
  Text,
  StyleSheet,
  ListView,
  PixelRatio,
  Animated,
  TextInput
} from 'react-native'

import React, { Component } from 'react'

import {
  isCharacter,
  sTrim,
  containsChinese
} from './utils/utils'

import SearchBar from './components/SearchBar'
import pinyin from 'js-pinyin'
import md5 from 'md5'
import Toolbar from './components/Toolbar'
import Touchable from './utils/Touchable'
import SectionIndex from './components/SectionIndex'
import PropTypes from 'prop-types'
import Theme from './components/Theme'

const {State: TextInputState} = TextInput
const searchBarHeight = 0
const defaultSectionHeight = Theme.size.sectionHeaderHeight
const defaultCellHeight = 0

export default class SearchList extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isSearching: false,
      isEmptyResult: false,
      dataSource: new ListView.DataSource({
        getSectionData: SearchList.getSectionData,
        getRowData: SearchList.getRowData,
        rowHasChanged: (row1, row2) => {
          if (row1 !== row2) {
            return true
          } else if (row1 && row2 && row1.macher && row2.macher && row1.macher !== row1.macher) {
            return true
          } else {
            return false
          }
        },
        sectionHeaderHasChanged: (s1, s2) => s1 !== s2
      }),

      animatedValue: new Animated.Value(0)
    }
    this.navBarYOffset = Theme.size.toolbarHeight
    this.searchStr = ''
    this.sectionIDs = []
    this.rowIDs = [[]]
    this.tmpSource = []
  }

  static getSectionData (dataBlob, sectionID) {
    return dataBlob[sectionID]
  }

  static getRowData (dataBlob, sectionID, rowID) {
    return dataBlob[sectionID + ':' + rowID]
  }

  componentWillMount () {

  }

  componentWillReceiveProps (nextProps) {
    if (nextProps && this.props.data !== nextProps.data) {
      this.tmpSource = Array.from(nextProps.data)
      this.initList(this.tmpSource)
    }
  }

  componentDidMount () {
    this.tmpSource = Array.from(this.props.data ? this.props.data : [])
    this.initList(this.tmpSource)

    pinyin.setOptions({checkPolyphone: false, charCase: 2})
  }

  generateSearchHandler (source) {
    let searchHandler = null
    if (containsChinese(source)) {
      searchHandler = {}
      searchHandler.charIndexerArr = []
      searchHandler.translatedStr = ''

      let translatedLength = 0
      for (let i = 0; i < source.length; i++) {
        let tempChar = source[i]

        let pinyinStr = pinyin.getFullChars(tempChar)

        let charIndexer = {}
        charIndexer.index = i
        charIndexer.startIndexInTransedStr = translatedLength
        charIndexer.endIndexInTransedStr = translatedLength + pinyinStr.length - 1
        charIndexer.pinyinStr = pinyinStr.toLowerCase()

        searchHandler.charIndexerArr.push(charIndexer)

        translatedLength += pinyinStr.length
        searchHandler.translatedStr += pinyinStr.toLowerCase()
      }
    }
    return searchHandler
  }

  orderList (srcList) {
    if (!srcList) {
      return
    }

    srcList.sort(this.props.sortFunc ? this.props.sortFunc : function (a, b) {
      if (!isCharacter(b.orderIndex)) {
        return -1
      } else if (!isCharacter(a.orderIndex)) {
        return 1
      } else if (b.orderIndex > a.orderIndex) {
        return -1
      } else if (b.orderIndex < a.orderIndex) {
        return 1
      } else {
        if (b.isCN > a.isCN) {
          return -1
        } else if (b.isCN < a.isCN) {
          return 1
        } else {
          return 0
        }
      }
    })
    this.parseList(srcList)
  }

  initList (srcList) {
    if (!srcList || srcList.length === 0) {
      return
    }
    srcList.forEach((item) => {
      if (item) {
        // 生成排序索引
        item.orderIndex = ''
        item.isCN = 0

        if (item.searchStr) {
          let tempStr = sTrim(item.searchStr)

          if (tempStr !== '') {
            // 补充首字母
            let firstChar = item.searchStr[0]

            if (containsChinese(firstChar)) {
              let pinyinChar = pinyin.getCamelChars(firstChar)

              if (pinyinChar) {
                item.orderIndex = pinyinChar.toUpperCase()
                item.isCN = 1
              }
            } else {
              item.orderIndex = firstChar.toUpperCase()
              item.isCN = 0
            }
          }
          // 对中文进行处理
          let handler = this.generateSearchHandler(item.searchStr)
          if (handler) {
            item.searchHandler = handler
          }
          if (!item.searchKey) {
            item.searchKey = md5(item.searchStr)
          }
        }
      }
    })
    this.orderList(srcList)
  }

  parseList (srcList) {
    if (!srcList) {
      return
    }
    let friendWithSection = {}
    this.sectionIDs = []
    this.rowIds = [[]]
    /* 形成如下的结构
     let dataBlob = {
     'sectionID1' : { ...section1 data },
     'sectionID1:rowID1' : { ...row1 data },
     'sectionID1:rowID2' : { ..row2 data },
     'sectionID2' : { ...section2 data },
     'sectionID2:rowID1' : { ...row1 data },
     'sectionID2:rowID2' : { ..row2 data },
     ...
     }
     let sectionIDs = [ 'sectionID1', 'sectionID2', ... ]
     let rowIDs = [ [ 'rowID1', 'rowID2' ], [ 'rowID1', 'rowID2' ], ... ]
     */
    srcList.forEach((item) => {
      if (item) {
        // 加入到section
        let orderIndex = item.orderIndex
        if (!isCharacter(item.orderIndex)) {
          orderIndex = '#'
        }
        if (!friendWithSection[orderIndex]) {
          friendWithSection[orderIndex] = orderIndex
          this.sectionIDs.push(orderIndex)
        }

        // rows组装
        // 1. 保证row数组长度和section数组长度一致
        let sectionIndex = this.sectionIDs.findIndex((tIndex) => {
          return orderIndex === tIndex
        })
        for (let i = this.rowIds.length; i <= sectionIndex; i++) {
          this.rowIds.push([])
        }
        // 2. 在section对应的数组加入row id
        let tRows = this.rowIds[sectionIndex]
        if (tRows) {
          tRows.push(item.searchKey)
        }

        // 3. 实际数据加入friendWithSection
        let itemKey = orderIndex + ':' + item.searchKey
        friendWithSection[itemKey] = item
      }
    })
    this.setState({
      isSearching: false,
      dataSource: this.state.dataSource.cloneWithRowsAndSections(friendWithSection, (!this.sectionIDs || this.sectionIDs.length === 0) ? [''] : this.sectionIDs, this.rowIds)
    })
  }

  search (input) {
    if (!this.tmpSource) {
      return
    }
    this.searchStr = input
    if (input) {
      input = sTrim(input)
      let inputLower = input.toLowerCase()
      let tempResult = []
      this.tmpSource.forEach((item, idx, array) => {
        if (item) {
          // 全局匹配字符
          if (item.searchStr) {
            let searchHandler = item.searchHandler
            let result = this.generateMacherInto(item.searchStr, item, inputLower, searchHandler ? searchHandler.translatedStr : '', searchHandler ? searchHandler.charIndexerArr : [])
            if (result.macher) {
              tempResult.push(result)
            }
          }
        }
      })
      if (tempResult.length === 0) {
        this.setState({
          isEmptyResult: true,
          isSearching: true
        })
      } else {
        this.orderResultList(tempResult)
      }
    } else {
      // 重置为原来的列表
      this.parseList(this.tmpSource)
    }
  }

  orderResultList (searchResultList) {
    if (!searchResultList) {
      this.setState({isEmptyResult: true, isSearching: true})
      return
    }

    searchResultList.sort(this.props.resultSortFunc ? this.props.resultSortFunc : function (a, b) {
      if (b.macher && a.macher) {
        if (b.macher.machStart < a.macher.machStart) {
          return 1
        } else if (b.macher.machStart > a.macher.machStart) {
          return -1
        } else {
          return 0
        }
      } else {
        return 0
      }
    })
    let searchResultWithSection = {'': ''}
    this.rowIds = [[]]
    let tRows = this.rowIds[0]
    searchResultList.forEach((result) => {
      tRows.push(result.searchKey)
      searchResultWithSection[':' + result.searchKey] = result
    })
    this.setState({
      isEmptyResult: false,
      isSearching: true,
      dataSource: this.state.dataSource.cloneWithRowsAndSections(searchResultWithSection, [''], this.rowIds)
    })
  }

  // FIXME 这个函数需要改造为一个字符串匹配多项
  generateMacherInto (source, item, inputLower, transStr, charIndexer) {
    let result = {}
    Object.assign(result, item)
    if (source) {
      let macher = {}
      macher.matches = []
      if (source.toLowerCase().indexOf(inputLower) >= 0) {
        macher.machStart = source.toLowerCase().indexOf(inputLower)
        macher.machEnd = macher.machStart + inputLower.length

        macher.matches.push({'start': macher.machStart, 'end': macher.machEnd})
        result.macher = macher
      } else {
        if (transStr && charIndexer) {
          let inputStartIndex = transStr.indexOf(inputLower)
          if (inputStartIndex >= 0) {
            for (let i = 0; i < charIndexer.length; i++) {
              let startCharIndexer = charIndexer[i]

              if (startCharIndexer) {
                if (startCharIndexer.startIndexInTransedStr === inputStartIndex) {
                  let inputEndIndex = inputStartIndex + inputLower.length - 1
                  let find = false
                  for (let j = i; j < charIndexer.length; j++) {
                    let endCharIndexer = charIndexer[j]

                    if (inputEndIndex <= endCharIndexer.endIndexInTransedStr) {
                      find = true
                      macher.machStart = startCharIndexer.index
                      macher.machEnd = endCharIndexer.index + 1
                      macher.matches.push({'start': macher.machStart, 'end': macher.machEnd})
                      result.macher = macher
                      break
                    }
                  }

                  if (find) {
                    break
                  }
                }
              }
            }
          }
        }
      }
    }

    return result
  }

  renderSectionHeader (sectionData, sectionID) {
    if (!sectionID) {
      return (
        <View />)
    } else {
      return (
        <View style={[styles.sectionHeader, {height: this.props.sectionHeaderHeight || defaultSectionHeight}]}>
          <Text style={styles.sectionTitle}>{sectionID}</Text>
        </View>)
    }
  }

  renderAlphaSection (sectionData, sectionID) {
    return (<Text style={{color: '#171a23', fontSize: 11, width: 36, height: 14}}>{sectionID}</Text>)
  }

  renderSeparator (sectionID,
                   rowID,
                   adjacentRowHighlighted) {
    if (this.props.renderSeparator) {
      return this.props.renderSeparator(sectionID, rowID, adjacentRowHighlighted)
    } else {
      let style = styles.rowSeparator
      if (adjacentRowHighlighted) {
        style = [style, styles.rowSeparatorHide]
      }
      return (
        <View key={'SEP_' + sectionID + '_' + rowID} style={style}>
          <View style={{
            height: 1 / PixelRatio.get(),
            backgroundColor: '#efefef'
          }}/>
        </View>
      )
    }
  }

  renderFooter () {
    return <View style={styles.scrollSpinner}/>
  }

  renderRow (item,
             sectionID,
             rowID,
             highlightRowFunc) {
    if (this.props.renderRow) {
      return this.props.renderRow(item, sectionID, rowID, highlightRowFunc, this.state.isSearching)
    } else {
      return <View style={{flex: 1, height: this.props.cellHeight || defaultCellHeight}}>
        <Text>{item && item.searchStr ? item.searchStr : ''}</Text>
      </View>
    }
  }

  enterSearchState () {
    this.setState({isSearching: true})
    Animated.timing(this.state.animatedValue, {
      duration: Theme.duration.toggleSearchBar,
      toValue: 1
    }).start(() => {
    })
  }

  exitSearchState () {
    Animated.timing(this.state.animatedValue, {
      duration: Theme.duration.toggleSearchBar,
      toValue: 0
    }).start(() => {
      this.search('')
      this.setState({isSearching: false, isEmptyResult: false})
    })
  }

  onFocus () {
    if (!this.state.isSearching) {
      this.enterSearchState()
    }
  }

  onBlur () {
    // this.cancelSearch()
  }

  onClickBack () {
    this.props.onClickBack && this.props.onClickBack()
  }

  onClickCancel () {
    this.exitSearchState()
  }

  cancelSearch () {
    this.refs.searchBar && this.refs.searchBar.cancelSearch && this.refs.searchBar.cancelSearch()
  }

  scrollToSection (section) {
    if (!this.sectionIDs || this.sectionIDs.length === 0) {
      return
    }
    let y = this.props.headerHeight || 0

    let cellHeight = this.props.cellHeight || defaultCellHeight
    let sectionHeaderHeight = this.props.sectionHeaderHeight || defaultSectionHeight
    let index = this.sectionIDs.indexOf(section)

    let numcells = 0
    for (let i = 0; i < index && i < this.rowIds.length; i++) {
      numcells += this.rowIds[i].length
    }

    sectionHeaderHeight = index * sectionHeaderHeight
    y += numcells * cellHeight + sectionHeaderHeight

    this.refs.searchListView.scrollTo({x: 0, y: y, animated: false})

    this.props.onScrollToSection && this.props.onScrollToSection(section)
  }

  render () {
    return (
      <Animated.View
        ref='view'
        style={[{
          height: Theme.size.windowHeight + Theme.size.toolbarHeight,
          width: Theme.size.windowWidth,
          transform: [
            {
              translateY: this.state.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -Theme.size.toolbarHeight]
              })
            }
          ]
        }, this.props.style]}>
        <View style={{
          flex: 1,
          backgroundColor: '#171a23'
        }}>
          <Toolbar
            style={[styles.toolbar, {
              opacity: this.state.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0]
              })
            }]}
            // searchBarBgColor={this.props.searchBarBgColor ? this.props.searchBarBgColor : '#171a23'}
            title={this.props.title}
            hideBack={!this.props.onClickBack}
            textColor={this.props.textColor}
            leftButtonStyle={this.props.leftButtonStyle}
            backIcon={this.props.backIcon}
            backIconStyle={this.props.backIconStyle}
            onClickBack={this.onClickBack.bind(this)}/>
          <SearchBar
            placeholder={this.props.searchPlaceHolder ? this.props.searchPlaceHolder : ''}
            onChange={this.search.bind(this)}
            onFocus={this.onFocus.bind(this)}
            onBlur={this.onBlur.bind(this)}
            onClickCancel={this.onClickCancel.bind(this)}
            cancelTitle={this.props.cancelTitle}
            textColor={this.props.textColor}
            customSearchBarStyle={this.props.customSearchBarStyle}
            activeSearchBarColor={this.props.activeSearchBarColor}
            showActiveSearchIcon={this.props.showActiveSearchIcon}
            searchBarActiveColor={this.props.searchBarActiveColor}
            ref='searchBar'/>
          {this._renderStickHeader()}

          <View
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
            style={styles.listContainer}>
            {this._renderSearchBody.bind(this)()}
            {this._renderSecetionIndex.bind(this)()}
          </View>
        </View>
        {this._renderMask.bind(this)()}
      </Animated.View>
    )
  }

  _renderSearchBody () {
    const {isSearching, isEmptyResult} = this.state
    const {renderEmptyResult, renderEmpty, data} = this.props

    if (isSearching && isEmptyResult && renderEmptyResult) {
      return renderEmptyResult(this.searchStr)
    } else {
      if (data && data.length > 0) {
        return (
          <ListView
            initialListSize={15}
            pageSize={10}
            onEndReachedThreshold={30}
            ref='searchListView'
            dataSource={this.state.dataSource}
            renderRow={this.renderRow.bind(this)}
            keyboardDismissMode='on-drag'
            keyboardShouldPersistTaps='always'
            showsVerticalScrollIndicator
            renderSeparator={this.props.renderSeparator ? this.props.renderSeparator : this.renderSeparator.bind(this)}
            renderSectionHeader={this.props.renderSectionHeader ? this.props.renderSectionHeader : this.renderSectionHeader.bind(this)}
            renderFooter={this.props.renderFooter ? this.props.renderFooter : this.renderFooter.bind(this)}
            renderHeader={this.props.renderHeader && this.props.renderHeader}
            enableEmptySections/>
        )
      } else {
        if (renderEmpty) {
          return renderEmpty()
        }
      }
    }
  }

  _renderStickHeader () {
    const {renderStickHeader} = this.props
    const {isSearching} = this.state
    if (!isSearching && renderStickHeader) {
      return renderStickHeader()
    }
  }

  _renderMask () {
    const {isSearching} = this.state
    if (isSearching && !this.searchStr) {
      return (
        <Touchable
          onPress={this.cancelSearch.bind(this)} underlayColor='rgba(0, 0, 0, 0.0)'
          style={[styles.maskStyle, {
          }]}>
          <Animated.View
            style={[styles.maskStyle]}/>
        </Touchable>
      )
    }
  }

  _renderSecetionIndex () {
    // TODO
    const {hideSectionList} = this.props
    if (hideSectionList) {
      return null
    } else {
      return (
        <View style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: Theme.size.toolbarHeight,
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <SectionIndex
            style={{
              opacity: this.state.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0]
              })
            }}
            onSectionSelect={this.scrollToSection.bind(this)}
            sections={this.sectionIDs}
            renderSection={this.props.renderAlphaSection ? this.props.renderAlphaSection : this.renderAlphaSection.bind(this)}/>
        </View>
      )
    }
  }
}

SearchList.propTypes = {
  data: PropTypes.array.isRequired,
  renderRow: PropTypes.func.isRequired,
  cellHeight: PropTypes.number.isRequired,

  hideSectionList: PropTypes.bool,
  sectionHeaderHeight: PropTypes.number,
  searchBarBgColor: PropTypes.string,
  title: PropTypes.string,
  textColor: PropTypes.string,
  cancelTitle: PropTypes.string,

  sortFunc: PropTypes.func,
  resultSortFunc: PropTypes.func,
  renderSeparator: PropTypes.func,
  renderSectionHeader: PropTypes.func,
  onClickBack: PropTypes.func,
  onScrollToSection: PropTypes.func,
  renderAlphaSection: PropTypes.func,
  showActiveSearchIcon: PropTypes.bool,
  leftButtonStyle: PropTypes.object,
  backIcon: PropTypes.number,
  backIconStyle: PropTypes.object,
  renderComponentAboveHeader: PropTypes.func
}

const styles = StyleSheet.create({
  listContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  rowSeparator: {
    backgroundColor: '#fff',
    paddingLeft: 25
  },
  rowSeparatorHide: {
    opacity: 0.0
  },
  sectionHeader: {
    flex: 1,
    height: Theme.size.sectionHeaderHeight,
    justifyContent: 'center',
    paddingLeft: 25,
    backgroundColor: '#efefef'
  },
  sectionTitle: {
    color: '#979797',
    fontSize: 14
  },
  separator2: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    height: 1 / PixelRatio.get(),
    marginVertical: 1
  },
  toolbar: {
    height: Theme.size.toolbarHeight + Theme.size.statusBarHeight
  },
  maskStyle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.color.maskColor,
    zIndex: 999
  },
  scrollSpinner: {
    marginVertical: 40
  }
})